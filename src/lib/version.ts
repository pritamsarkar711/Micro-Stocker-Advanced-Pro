/**
 * Renderer-side app version.
 *
 * The packaged desktop app gets the real version from Electron
 * (`app.getVersion()`, i.e. package.json). The browser preview has no such
 * bridge, so it falls back to this constant — kept in sync with package.json
 * by a test in `tests/logic.test.ts`.
 */
export const APP_NAME = 'Micro Stocker Advanced Pro';
export const APP_VERSION = '2.3.1';
