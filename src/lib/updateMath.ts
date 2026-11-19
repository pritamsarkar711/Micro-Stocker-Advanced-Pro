/**
 * Pure release-math, kept apart from the network and the shells so the rules can
 * be unit tested: which version is newer, and which release asset belongs to the
 * container that is asking.
 */

export interface ReleaseAssetLike {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

/** `2.4.0` -> `[2, 4, 0]`, tolerating a leading `v` and pre-release suffixes. */
export function parseVersion(value: string): number[] {
  const cleaned = String(value).trim().replace(/^v/i, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map((part) => {
    const digits = Number.parseInt(part.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(digits) ? digits : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** True when `candidate` is a newer release than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return true;
    if (a[index] < b[index]) return false;
  }
  return false;
}

export type UpdateChannel = 'desktop' | 'android' | 'link';
export type DesktopPlatform = 'win32' | 'darwin' | 'linux' | 'web';

/**
 * The APK to install for an Android update.
 *
 * A release carries the signed release APK, and (for diagnostics) a debug APK.
 * The release build is the one users must install — it is not debuggable and is
 * the artifact whose signature and versionCode the Android workflow verifies —
 * so it always wins. The debug APK is only a fallback for older releases that
 * shipped nothing else, because taking the first `.apk` in listing order could
 * otherwise hand a user the debug build.
 */
export function pickAndroidApk(assets: ReleaseAssetLike[]): ReleaseAssetLike | null {
  const named = assets.filter((asset) => Boolean(asset.name && asset.browser_download_url));
  const ending = (suffix: string) =>
    named.find((asset) => String(asset.name).toLowerCase().endsWith(suffix)) ?? null;
  const release = ending('-release.apk');
  if (release) return release;
  const firstApk = ending('.apk');
  if (!firstApk) return null;
  // Ignore a debug APK when any other APK is present.
  if (!String(firstApk.name).toLowerCase().includes('debug')) return firstApk;
  return named.find(
    (asset) =>
      String(asset.name).toLowerCase().endsWith('.apk') &&
      !String(asset.name).toLowerCase().includes('debug'),
  ) ?? firstApk;
}

/** Pick the release file that this container can actually install. */
export function pickAssetFor(
  channel: UpdateChannel,
  assets: ReleaseAssetLike[],
  platform: DesktopPlatform = 'web',
): ReleaseAssetLike | null {
  const named = assets.filter((asset) => Boolean(asset.name && asset.browser_download_url));
  const find = (test: (name: string) => boolean) =>
    named.find((asset) => test(String(asset.name).toLowerCase())) ?? null;

  if (channel === 'android') return pickAndroidApk(assets);
  if (channel === 'desktop') {
    if (platform === 'win32') return find((name) => name.endsWith('.exe') && name.includes('setup'));
    if (platform === 'darwin') return find((name) => name.endsWith('.dmg'));
    if (platform === 'linux') return find((name) => name.endsWith('.appimage'));
    return null;
  }
  return (
    pickAndroidApk(assets) ??
    find((name) => name.endsWith('.dmg')) ??
    find((name) => name.endsWith('setup') || name.endsWith('.exe'))
  );
}

/** Human sentence for the release notes of a build, used by the banner. */
export function summarizeNotes(body: string, limit = 1200): string {
  return String(body ?? '').slice(0, limit);
}
