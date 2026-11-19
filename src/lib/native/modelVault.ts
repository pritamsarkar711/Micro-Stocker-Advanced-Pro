import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { InstalledModelRecord, ModelInstallSpec } from '@/lib/desktop';
import {
  base64ToBytes,
  bytesToBase64,
  parseContentRangeTotal,
  responseToBytes,
  safeFileName,
} from './bytes';

/**
 * Model vault for the Android / iOS build.
 *
 * Why this exists
 * ---------------
 * Model weights live on GitHub releases. A browser `fetch()` (and therefore a
 * WebView fetch) is stopped by the release CDN, because the redirect to
 * `objects.githubusercontent.com` carries no `Access-Control-Allow-Origin`
 * header. That is what produced "Direct model transfer was blocked by browser
 * network policy" and the pointless "use the desktop app" advice.
 *
 * Inside the app the download is not a web request at all: it goes through the
 * native HTTP bridge (`CapacitorHttp`), which has no origin policy, follows the
 * GitHub redirect and can stream a Range request per chunk. Bytes are written
 * straight into the app's private data directory
 * (`/data/data/<pkg>/files/models/<model>/…`) with the Filesystem plugin, so:
 *   - nothing is held in RAM (a 1 GB video pack is fine),
 *   - the OS keeps the files across restarts and deletes them on uninstall,
 *   - no SD card / Documents permission is needed,
 *   - progress is real byte progress, not a fake timer.
 *
 * A small manifest keeps the installed list so the UI can show "Installed"
 * instantly, and it is validated against the filesystem on read so a wiped
 * cache never claims a model exists.
 */

const ROOT = 'models';
const MANIFEST_PATH = `${ROOT}/manifest.json`;
/** 4 MiB chunks: small enough to survive a flaky network, big enough to be fast. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_RETRIES = 3;

export interface VaultRecord extends InstalledModelRecord {
  files: string[];
  totalBytes: number;
}

type Manifest = Record<string, VaultRecord>;

export interface VaultProgress {
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  fileIndex: number;
  label: string;
}

export interface VaultInstallOptions {
  onProgress?: (progress: VaultProgress) => void;
  isCanceled?: () => boolean;
  /** Cache for throwaway downloads (update APK), Data for installed models. */
  directory?: Directory;
}

export class DownloadCanceledError extends Error {
  canceled = true;
  constructor() {
    super('Download canceled');
    this.name = 'DownloadCanceledError';
  }
}

/* ------------------------------------------------------------------ helpers */

function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ----------------------------------------------------------------- manifest */

async function readManifest(): Promise<Manifest> {
  try {
    const file = await Filesystem.readFile({ path: MANIFEST_PATH, directory: Directory.Data });
    const text = typeof file.data === 'string' ? base64ToBytes(file.data) : new Uint8Array(0);
    const decoded = new TextDecoder().decode(text);
    const parsed = JSON.parse(decoded) as Manifest;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(manifest)));
  await Filesystem.writeFile({
    path: MANIFEST_PATH,
    data: encoded,
    directory: Directory.Data,
    recursive: true,
  });
}

/** Records whose files really exist on disk. */
export async function nativeListModels(): Promise<Record<string, VaultRecord>> {
  const manifest = await readManifest();
  const alive: Manifest = {};
  for (const [id, record] of Object.entries(manifest)) {
    try {
      await Filesystem.stat({ path: `${ROOT}/${safeFileName(id)}`, directory: Directory.Data });
      alive[id] = record;
    } catch {
      /* folder gone: drop the entry instead of lying to the UI */
    }
  }
  if (Object.keys(alive).length !== Object.keys(manifest).length) {
    await writeManifest(alive).catch(() => undefined);
  }
  return alive;
}

export async function nativeRemoveModel(id: string): Promise<void> {
  const manifest = await readManifest();
  delete manifest[id];
  await writeManifest(manifest).catch(() => undefined);
  try {
    await Filesystem.rmdir({ path: `${ROOT}/${safeFileName(id)}`, directory: Directory.Data, recursive: true });
  } catch {
    /* already gone */
  }
}

/**
 * Local URL for an installed file, served by the app's own local server.
 * Lets ONNX Runtime stream a 100 MB model instead of decoding it twice in the
 * JS heap, which is what used to crash low memory phones.
 */
export async function nativeModelFileUrl(id: string, fileName: string): Promise<string | null> {
  try {
    const { uri } = await Filesystem.getUri({
      path: `${ROOT}/${safeFileName(id)}/${safeFileName(fileName)}`,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uri);
  } catch {
    return null;
  }
}

export async function nativeReadModelBytes(id: string, fileName: string): Promise<Uint8Array> {
  const file = await Filesystem.readFile({
    path: `${ROOT}/${safeFileName(id)}/${safeFileName(fileName)}`,
    directory: Directory.Data,
  });
  if (typeof file.data !== 'string') throw new Error('Model file is unreadable');
  const bytes = base64ToBytes(file.data);
  if (!bytes.byteLength) throw new Error('Model file is empty');
  return bytes;
}

/* ---------------------------------------------------------------- download */

interface ChunkResult {
  bytes: Uint8Array;
  status: number;
  total: number;
}

async function requestChunk(url: string, start: number, size: number): Promise<ChunkResult> {
  const end = start + size - 1;
  const response = await CapacitorHttp.request({
    url,
    method: 'GET',
    headers: { Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity' },
    responseType: 'arraybuffer',
    connectTimeout: 30_000,
    readTimeout: 120_000,
  });
  return {
    bytes: responseToBytes(response.data),
    status: response.status,
    total: parseContentRangeTotal(headerValue(response.headers, 'content-range')),
  };
}

/**
 * Downloads one file into the vault using sequential range requests.
 * Returns the number of bytes written.
 */
export async function downloadFileToVault(
  url: string,
  destination: string,
  options: VaultInstallOptions & { baseBytes?: number; expectedTotalBytes?: number } = {},
): Promise<number> {
  const base = options.baseBytes ?? 0;
  const directory = options.directory ?? Directory.Data;
  let start = 0;
  let total = options.expectedTotalBytes ?? 0;
  let written = 0;
  let attempt = 0;
  let restarted = false;
  const startedAt = Date.now();

  const report = () => {
    const elapsed = Math.max(0.35, (Date.now() - startedAt) / 1000);
    options.onProgress?.({
      loadedBytes: base + written,
      totalBytes: total ? base + total : 0,
      speedBps: Math.round(written / elapsed),
      fileIndex: 0,
      label: '',
    });
  };

  for (;;) {
    if (options.isCanceled?.()) throw new DownloadCanceledError();
    let chunk: ChunkResult;
    try {
      chunk = await requestChunk(url, start, CHUNK_BYTES);
    } catch (error) {
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        throw new Error(
          `Download interrupted after ${MAX_RETRIES} retries${start > 0 ? ` at ${Math.round(start / 1_048_576)} MB` : ''}. Check the connection and try again.`,
        );
      }
      await sleep(400 * attempt);
      continue;
    }
    attempt = 0;

    if (chunk.status === 416) break; // range already satisfied
    if (chunk.status >= 400) {
      throw new Error(`Server refused the download (HTTP ${chunk.status}).`);
    }
    // Server ignored Range and sent the whole body again mid-file: restart.
    if (chunk.status === 200 && start > 0 && !restarted) {
      restarted = true;
      start = 0;
      written = 0;
      await Filesystem.deleteFile({ path: destination, directory }).catch(() => undefined);
      continue;
    }
    if (!chunk.bytes.byteLength) break;

    if (!total && chunk.total) total = chunk.total;

    const payload = bytesToBase64(chunk.bytes);
    if (start === 0) {
      await Filesystem.writeFile({ path: destination, data: payload, directory, recursive: true });
    } else {
      await Filesystem.appendFile({ path: destination, data: payload, directory });
    }
    start += chunk.bytes.byteLength;
    written += chunk.bytes.byteLength;
    report();

    if (chunk.status === 200) break; // whole file in a single response
    if (total && start >= total) break;
    if (chunk.bytes.byteLength < CHUNK_BYTES) break;
  }

  if (!written) throw new Error('The server returned an empty file.');
  if (total && written < total) {
    throw new Error(`Download stopped early (${Math.round(written / 1_048_576)} of ${Math.round(total / 1_048_576)} MB). Try again on Wi-Fi.`);
  }
  return written;
}

/** Installs a spec into the app private folder. Desktop-only packages are refused. */
export async function nativeInstallModel(
  spec: ModelInstallSpec,
  options: VaultInstallOptions = {},
): Promise<{ ok: boolean; canceled?: boolean; record?: VaultRecord; error?: string }> {
  const id = safeFileName(spec.id);
  const dir = `${ROOT}/${id}`;
  const manifest = await readManifest();

  try {
    if (spec.files.some((file) => file.extractZip)) {
      return {
        ok: false,
        error: 'That engine is a desktop graphics pack. Pick a phone-ready model instead.',
      };
    }

    let completed = 0;
    const installedFiles: string[] = [];
    const approx = spec.approxBytes ?? 0;

    for (let index = 0; index < spec.files.length; index += 1) {
      const file = spec.files[index];
      const guessed = file.name || file.url.split('/').pop() || `part_${index}.bin`;
      const name = safeFileName(guessed);
      const destination = `${dir}/${name}`;
      options.onProgress?.({
        loadedBytes: completed,
        totalBytes: approx,
        speedBps: 0,
        fileIndex: index,
        label: file.label || name,
      });
      const bytes = await downloadFileToVault(file.url, destination, {
        ...options,
        baseBytes: completed,
        expectedTotalBytes: index === 0 && spec.files.length === 1 ? approx : 0,
      });
      completed += bytes;
      installedFiles.push(name);
    }

    const record: VaultRecord = {
      id: spec.id,
      kind: spec.kind,
      primaryFile: safeFileName(spec.primaryFile || installedFiles[0] || 'model.bin'),
      sizeBytes: completed,
      totalBytes: completed,
      installedAt: new Date().toISOString(),
      files: installedFiles,
    };
    manifest[spec.id] = record;
    await writeManifest(manifest);
    options.onProgress?.({
      loadedBytes: completed,
      totalBytes: completed,
      speedBps: 0,
      fileIndex: spec.files.length,
      label: 'Installed',
    });
    return { ok: true, record };
  } catch (error) {
    await Filesystem.rmdir({ path: dir, directory: Directory.Data, recursive: true }).catch(() => undefined);
    const canceled = error instanceof DownloadCanceledError || (error as { canceled?: boolean })?.canceled === true;
    return {
      ok: false,
      canceled,
      error: canceled ? 'Download canceled' : error instanceof Error ? error.message : String(error),
    };
  }
}
