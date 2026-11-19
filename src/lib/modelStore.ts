import {
  desktop,
  type InstalledModelRecord,
  type ModelInstallSpec,
  type ModelProgressEvent,
} from './desktop';
import { isNativeShell } from './native/platform';

/**
 * Unified in app model store.
 *
 * All model downloads, extraction, caching, inspection and removal happen
 * directly inside Micro Stocker Advanced Pro:
 *  In Electron, weights & NCNN Vulkan engines install into userData/models/
 *  In the Android / iOS app, files stream through the native HTTP bridge into
 *  the app's private data directory (see native/modelVault.ts) so the release
 *  CDN's missing CORS headers cannot block them.
 *  In a plain browser tab, portable weight files stream into IndexedDB with
 *  live byte progress, abort support and instant reload across sessions.
 *
 * External download pages are never opened.
 */

const IDB_NAME = 'msap-model-store-v1';
const IDB_VERSION = 1;
const STORE_META = 'meta';
const STORE_BLOBS = 'blobs';

const browserControllers = new Map<string, AbortController>();
const nativeActive = new Set<string>();
const nativeCancels = new Set<string>();
const listeners = new Set<(event: ModelProgressEvent) => void>();

function emit(event: ModelProgressEvent) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      /* ignore listener errors */
    }
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open local model database'));
  });
}

async function idbList(): Promise<InstalledModelRecord[]> {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => resolve((req.result as InstalledModelRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbSave(record: InstalledModelRecord, blobs: Array<{ name: string; bytes: Uint8Array }>) {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_META).put(record);
    const blobStore = tx.objectStore(STORE_BLOBS);
    for (const item of blobs) {
      blobStore.put({ key: `${record.id}:${item.name}`, id: record.id, bytes: item.bytes });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed saving model in storage'));
  });
}

async function idbRead(id: string, fileName: string): Promise<Uint8Array> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(`${id}:${fileName}`);
    req.onsuccess = () => {
      const row = req.result as { bytes?: Uint8Array } | undefined;
      if (row?.bytes) resolve(row.bytes);
      else reject(new Error('Model file not found in local cache'));
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbRemove(id: string): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_META).delete(id);
      const blobStore = tx.objectStore(STORE_BLOBS);
      const cursorReq = blobStore.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const val = cursor.value as { id?: string };
        if (val?.id === id) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

async function fetchBytesWithProgress(
  url: string,
  signal: AbortSignal,
  onChunk: (loaded: number, total: number, speedBps: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading model`);
  }
  const total = Number(response.headers.get('content-length') || 0);
  const startedAt = Date.now();
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    const elapsed = Math.max(0.2, (Date.now() - startedAt) / 1000);
    onChunk(buf.byteLength, buf.byteLength, Math.round(buf.byteLength / elapsed));
    return buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength) {
      chunks.push(value);
      loaded += value.byteLength;
      const elapsed = Math.max(0.2, (Date.now() - startedAt) / 1000);
      onChunk(loaded, total, Math.round(loaded / elapsed));
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function onModelProgress(callback: (event: ModelProgressEvent) => void): () => void {
  listeners.add(callback);
  const offDesktop = desktop.isDesktop ? desktop.models.onProgress(callback) : () => {};
  return () => {
    listeners.delete(callback);
    offDesktop();
  };
}

export async function listInstalledModels(): Promise<Record<string, InstalledModelRecord>> {
  const map: Record<string, InstalledModelRecord> = {};
  if (desktop.isDesktop) {
    const res = await desktop.models.list();
    for (const item of res.items ?? []) map[item.id] = item;
  } else if (isNativeShell()) {
    try {
      const { nativeListModels } = await import('./native/modelVault');
      const nativeItems = await nativeListModels();
      for (const item of Object.values(nativeItems)) map[item.id] = item;
    } catch {
      /* fall through to the IndexedDB mirror */
    }
  }
  const browserItems = await idbList();
  for (const item of browserItems) {
    if (!map[item.id]) map[item.id] = item;
  }
  return map;
}

/**
 * Phone / tablet path: native HTTP download into the app private folder.
 * Exposed separately so the UI can tell the two mechanisms apart in messages.
 */
async function installModelOnDevice(spec: ModelInstallSpec): Promise<{
  ok: boolean;
  canceled?: boolean;
  record?: InstalledModelRecord;
  error?: string;
}> {
  if (nativeActive.has(spec.id)) {
    return { ok: false, error: 'Model download is already running' };
  }
  const roomCheck = await hasRoomFor(spec.approxBytes ?? 0);
  if (!roomCheck.ok) return { ok: false, error: roomCheck.error };
  nativeActive.add(spec.id);
  nativeCancels.delete(spec.id);
  try {
    const { nativeInstallModel } = await import('./native/modelVault');
    const result = await nativeInstallModel(spec, {
      isCanceled: () => nativeCancels.has(spec.id),
      onProgress: (progress) => {
        emit({
          id: spec.id,
          phase: progress.label === 'Installed' ? 'ready' : 'downloading',
          fileIndex: progress.fileIndex,
          fileCount: spec.files.length,
          loadedBytes: progress.loadedBytes,
          totalBytes: progress.totalBytes || spec.approxBytes || 0,
          speedBps: progress.speedBps,
          label: progress.label || spec.files[progress.fileIndex]?.label || spec.id,
        });
      },
    });
    if (result.ok && result.record) {
      emit({
        id: spec.id,
        phase: 'ready',
        fileIndex: spec.files.length,
        fileCount: spec.files.length,
        loadedBytes: result.record.sizeBytes,
        totalBytes: result.record.sizeBytes,
        speedBps: 0,
        label: 'Installed',
      });
    }
    return result;
  } catch (error) {
    return { ok: false, error: explainInstallError(error instanceof Error ? error.message : String(error)) };
  } finally {
    nativeActive.delete(spec.id);
    nativeCancels.delete(spec.id);
  }
}

export async function installModelInApp(
  spec: ModelInstallSpec,
  options?: { preferIdb?: boolean },
): Promise<{ ok: boolean; canceled?: boolean; record?: InstalledModelRecord; error?: string }> {
  if (desktop.isDesktop && !options?.preferIdb) {
    return desktop.models.install(spec);
  }

  if (isNativeShell() && !options?.preferIdb) {
    return installModelOnDevice(spec);
  }

  if (browserControllers.has(spec.id)) {
    return { ok: false, error: 'Model download is already running' };
  }
  const roomCheck = await hasRoomFor(spec.approxBytes ?? 0);
  if (!roomCheck.ok) return { ok: false, error: roomCheck.error };
  const controller = new AbortController();
  browserControllers.set(spec.id, controller);

  try {
    const saved: Array<{ name: string; bytes: Uint8Array }> = [];
    let totalBytes = 0;
    for (let idx = 0; idx < spec.files.length; idx++) {
      const file = spec.files[idx];
      const fallbackName = file.url.split('/').pop() || `part_${idx}.bin`;
      const name = file.name || fallbackName;
      const bytes = await fetchBytesWithProgress(file.url, controller.signal, (loaded, total, speed) => {
        emit({
          id: spec.id,
          phase: 'downloading',
          fileIndex: idx,
          fileCount: spec.files.length,
          loadedBytes: loaded,
          totalBytes: total || spec.approxBytes || 0,
          speedBps: speed,
          label: file.label || name,
        });
      });
      saved.push({ name, bytes });
      totalBytes += bytes.byteLength;
    }

    const record: InstalledModelRecord = {
      id: spec.id,
      kind: spec.kind,
      primaryFile: spec.primaryFile || saved[0]?.name,
      sizeBytes: totalBytes,
      installedAt: new Date().toISOString(),
    };
    await idbSave(record, saved);
    emit({
      id: spec.id,
      phase: 'ready',
      fileIndex: spec.files.length,
      fileCount: spec.files.length,
      loadedBytes: totalBytes,
      totalBytes: totalBytes,
      speedBps: 0,
      label: 'Installed',
    });
    return { ok: true, record };
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      canceled: aborted,
      error: aborted ? 'Download canceled' : explainInstallError(message),
    };
  } finally {
    browserControllers.delete(spec.id);
  }
}

export async function cancelModelInstall(id: string): Promise<void> {
  browserControllers.get(id)?.abort();
  if (isNativeShell() && nativeActive.has(id)) nativeCancels.add(id);
  if (desktop.isDesktop) {
    await desktop.models.cancel(id);
  }
}

export async function uninstallModelInApp(id: string): Promise<void> {
  await idbRemove(id);
  if (isNativeShell() && !desktop.isDesktop) {
    try {
      const { nativeRemoveModel } = await import('./native/modelVault');
      await nativeRemoveModel(id);
    } catch {
      /* nothing installed on device */
    }
  }
  if (desktop.isDesktop) {
    await desktop.models.remove(id);
  }
}

export async function readInstalledModelBytes(id: string, fileName: string): Promise<Uint8Array> {
  if (desktop.isDesktop) {
    try {
      return await desktop.models.readBytes(id, fileName);
    } catch {
      /* fall through to IDB cache */
    }
  }
  if (isNativeShell()) {
    try {
      const { nativeReadModelBytes } = await import('./native/modelVault');
      return await nativeReadModelBytes(id, fileName);
    } catch {
      /* fall through to IDB cache */
    }
  }
  return idbRead(id, fileName);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A URL the WebView can read an installed model from, or null when the bytes
 * have to be read into memory instead (browser / desktop).
 */

/**
 * A tiny install is not the usual failure, but a phone with a full data
 * partition fails halfway through a chunk with a vendor specific message. Check
 * the free space up front so the user gets one clear sentence instead.
 */
export async function hasRoomFor(approxBytes: number): Promise<{ ok: boolean; error?: string; freeBytes?: number }> {
  if (!approxBytes || approxBytes <= 0) return { ok: true };
  const needed = Math.round(approxBytes * 1.15);
  try {
    const storage = (navigator as Navigator & { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } })
      .storage;
    if (storage?.estimate) {
      const { quota = 0, usage = 0 } = await storage.estimate();
      const free = Math.max(0, quota - usage);
      // A quota of 0 only means the browser declined to answer; never block on it.
      if (quota > 0 && free < needed) {
        return {
          ok: false,
          freeBytes: free,
          error: `This device only has ${formatMb(free)} free. The model needs ${formatMb(needed)}. Free some space and try again.`,
        };
      }
    }
  } catch {
    /* estimating is best effort; the download reports its own failure */
  }
  return { ok: true };
}

function formatMb(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Turn a raw platform error into a sentence a user can act on. */
export function explainInstallError(message: string): string {
  const text = String(message ?? '');
  if (/ENOSPC|No space left|not enough space|insufficient storage|SQLITE_FULL/i.test(text)) {
    return 'The device ran out of space while installing the model. Free some storage and try again.';
  }
  if (/ENETUNREACH|ECONNRESET|ETIMEDOUT|network|Failed to fetch|Load failed|offline/i.test(text)) {
    return 'The download was interrupted. Check the connection and try again — the partial file is kept.';
  }
  if (/403|404|Not Found|Forbidden/i.test(text)) {
    return 'The model file is not available at the moment. Try another model, or retry later.';
  }
  return text || 'Model installation failed';
}

export async function installedModelUrl(id: string, fileName: string): Promise<string | null> {
  if (!isNativeShell() || desktop.isDesktop) return null;
  try {
    const { nativeModelFileUrl } = await import('./native/modelVault');
    return await nativeModelFileUrl(id, fileName);
  } catch {
    return null;
  }
}

/** Where installed weights live, for the storage row in settings. */
export function modelStoreLocation(): string {
  if (desktop.isDesktop) return 'Desktop app data folder';
  if (isNativeShell()) return 'App private storage (survives updates, removed on uninstall)';
  return 'Browser storage on this device';
}

export function desktopPlatformKey(): 'windows' | 'macos' | 'linux' {
  if (desktop.platform === 'win32') return 'windows';
  if (desktop.platform === 'darwin') return 'macos';
  return 'linux';
}
