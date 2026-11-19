import { Capacitor } from '@capacitor/core';

/**
 * One place to ask "what am I running in?".
 *
 * The renderer lives inside three very different containers:
 *  - Electron  -> desktop.isDesktop, full disk + native downloads
 *  - Android/iOS WebView (Capacitor) -> native plugins available, real storage
 *  - plain browser tab -> sandboxed, cross origin downloads can be blocked
 *
 * Model install and the update check both need this distinction, so it lives
 * here instead of being re-derived with user agent sniffing in every page.
 */
export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): 'android' | 'ios' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return platform;
    return 'web';
  } catch {
    return 'web';
  }
}

/** True when the container can download large files without CORS in the way. */
export function canDownloadNatively(): boolean {
  return isNativeShell();
}
