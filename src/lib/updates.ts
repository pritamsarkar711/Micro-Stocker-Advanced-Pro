import { httpRequest, desktop } from './desktop';
import { isNativeShell, nativePlatform } from './native/platform';
import { APP_VERSION } from './version';
import { isNewerVersion, pickAssetFor, type UpdateChannel } from './updateMath';

export { isNewerVersion, parseVersion, pickAssetFor } from './updateMath';

/**
 * In-app updates.
 *
 * Every container gets a notice from the same place, but the install step is
 * different:
 *
 * | container            | check            | install                                  |
 * |----------------------|------------------|------------------------------------------|
 * | Electron (Windows)   | electron-updater | downloads, then restarts into the new exe |
 * | Android app          | GitHub releases  │ downloads the APK, hands it to the OS     |
 * | iOS app              | GitHub releases  │ Play/App Store rules forbid self update   |
 * | browser tab          | GitHub releases  │ shows the download link                   |
 *
 * The GitHub Releases API is used because it is the source of truth for what is
 * published, needs no extra file to keep in sync, and answers with CORS headers
 * so the browser path works too.
 */

export const RELEASES_PAGE = 'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases/latest';

export interface AvailableUpdate {
  version: string;
  tag: string;
  notes: string;
  publishedAt: string;
  assetName: string | null;
  assetUrl: string | null;
  sizeBytes: number;
  /** How this container should install it. */
  channel: UpdateChannel;
}

export interface UpdateCheck {
  ok: boolean;
  current: string;
  update?: AvailableUpdate;
  error?: string;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

export function updateChannel(): AvailableUpdate['channel'] {
  if (desktop.isDesktop) return 'desktop';
  if (isNativeShell()) return nativePlatform() === 'android' ? 'android' : 'link';
  return 'link';
}

export async function checkForUpdates(): Promise<UpdateCheck> {
  const current = APP_VERSION;
  const channel = updateChannel();

  if (channel === 'desktop' && desktop.updates?.check) {
    const result = await desktop.updates.check();
    if (!result.ok) return { ok: false, current, error: result.error ?? 'Could not reach the update server' };
    if (!result.version || !isNewerVersion(result.version, current)) return { ok: true, current };
    return {
      ok: true,
      current,
      update: {
        version: result.version,
        tag: result.version,
        notes: result.notes ?? '',
        publishedAt: result.publishedAt ?? new Date().toISOString(),
        assetName: null,
        assetUrl: null,
        sizeBytes: 0,
        channel,
      },
    };
  }

  const response = await httpRequest({
    url: 'https://api.github.com/repos/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases/latest',
    method: 'GET',
    headers: { Accept: 'application/vnd.github+json' },
    timeoutMs: 15000,
  });
  if (!response.ok || !response.text) {
    return {
      ok: false,
      current,
      error: response.status === 404 ? 'No release published yet' : response.error ?? `GitHub answered ${response.status}`,
    };
  }

  let payload: { tag_name?: string; name?: string; body?: string; published_at?: string; assets?: ReleaseAsset[] };
  try {
    payload = JSON.parse(response.text) as typeof payload;
  } catch {
    return { ok: false, current, error: 'The release feed was not readable' };
  }

  const version = String(payload.tag_name ?? '').replace(/^v/i, '');
  if (!version || !isNewerVersion(version, current)) return { ok: true, current };

  const asset = pickAssetFor(channel, payload.assets ?? [], desktop.platform);
  return {
    ok: true,
    current,
    update: {
      version,
      tag: String(payload.tag_name ?? version),
      notes: String(payload.body ?? '').slice(0, 1200),
      publishedAt: String(payload.published_at ?? new Date().toISOString()),
      assetName: asset?.name ?? null,
      assetUrl: asset?.browser_download_url ?? null,
      sizeBytes: Number(asset?.size ?? 0),
      channel,
    },
  };
}

/* ------------------------------------------------------------- android apk */

interface AppUpdaterPlugin {
  install(options: { path: string }): Promise<void>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  getBuild(): Promise<{ versionName: string; versionCode: number }>;
}

async function appUpdater(): Promise<AppUpdaterPlugin | null> {
  if (!isNativeShell() || nativePlatform() !== 'android') return null;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    return registerPlugin<AppUpdaterPlugin>('AppUpdater');
  } catch {
    return null;
  }
}

export async function apkInstallAllowed(): Promise<boolean> {
  const plugin = await appUpdater();
  if (!plugin) return false;
  try {
    const result = await plugin.canInstall();
    return Boolean(result.allowed);
  } catch {
    return false;
  }
}

export async function openApkInstallSettings(): Promise<void> {
  const plugin = await appUpdater();
  await plugin?.openInstallSettings().catch(() => undefined);
}

const UPDATE_APK = 'msap-update.apk';

/**
 * Downloads the release APK into the app's cache folder and returns the path the
 * installer needs. Progress is real bytes, same chunk engine the model vault uses.
 */
export async function downloadApk(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ path: string; sizeBytes: number }> {
  const { Directory, Filesystem } = await import('@capacitor/filesystem');
  const { downloadFileToVault } = await import('./native/modelVault');
  const targetPath = `updates/${UPDATE_APK}`;
  await Filesystem.mkdir({ path: 'updates', directory: Directory.Cache, recursive: true }).catch(() => undefined);
  await Filesystem.deleteFile({ path: targetPath, directory: Directory.Cache }).catch(() => undefined);
  const sizeBytes = await downloadFileToVault(url, targetPath, {
    directory: Directory.Cache,
    onProgress: (progress) => onProgress?.(progress.loadedBytes, progress.totalBytes),
  });
  const { uri } = await Filesystem.getUri({ path: targetPath, directory: Directory.Cache });
  return { path: uri.replace(/^file:\/\//, ''), sizeBytes };
}

export async function installDownloadedApk(path: string): Promise<void> {
  const plugin = await appUpdater();
  if (!plugin) throw new Error('The installer is only available in the Android app.');
  await plugin.install({ path });
}

/* ------------------------------------------------------------------ desktop */

export interface DesktopUpdateProgress {
  status: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error';
  percent?: number;
  version?: string;
  error?: string;
}

export function onDesktopUpdateProgress(callback: (progress: DesktopUpdateProgress) => void): () => void {
  if (!desktop.isDesktop || !desktop.updates?.onProgress) return () => {};
  return desktop.updates.onProgress(callback);
}

export async function desktopDownloadUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (!desktop.isDesktop || !desktop.updates?.download) return { ok: false, error: 'Desktop only' };
  return desktop.updates.download();
}

export async function desktopInstallUpdate(): Promise<void> {
  if (!desktop.isDesktop || !desktop.updates?.install) return;
  await desktop.updates.install();
}
