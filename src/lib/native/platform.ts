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

/**
 * True only inside the Android WebView (Capacitor).
 *
 * The Android build is a deliberately simplified studio: generators, the
 * Vector Studio, the submission tracker and platform rules are hidden there,
 * while the desktop build keeps them exactly as they are. Every Android-only
 * branch in the app asks this one function instead of sniffing the user
 * agent, so the desktop bundle is untouched.
 *
 * A `?platform=android` query parameter forces the Android layout in a
 * desktop browser preview for testing; it never affects the packaged app.
 */
export function isAndroid(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('platform');
      if (forced === 'android') return true;
      if (forced === 'desktop') return false;
    }
    return nativePlatform() === 'android';
  } catch {
    return false;
  }
}

/** True inside any native shell (Android or iOS). */
export function isNative(): boolean {
  return isNativeShell();
}
