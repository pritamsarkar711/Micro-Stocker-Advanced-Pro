/**
 * Renderer-side app version.
 *
 * The packaged desktop app gets the real version from Electron
 * (`app.getVersion()`, i.e. package.json). The browser preview has no such
 * bridge, so it falls back to this constant — kept in sync with package.json
 * by a test in `tests/logic.test.ts`.
 */
import { isAndroid } from './native/platform';

export const APP_NAME = 'Micro Stocker Advanced Pro';
export const ANDROID_APP_NAME = 'vecmotion';
export const APP_VERSION = '2.3.2';

/**
 * The name shown to the user. The Android build is branded vecmotion; the
 * desktop build keeps Micro Stocker Advanced Pro exactly as before.
 */
export function appName(): string {
  try {
    return isAndroid() ? ANDROID_APP_NAME : APP_NAME;
  } catch {
    return APP_NAME;
  }
}
