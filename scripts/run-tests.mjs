/**
 * Bundles tests/logic.test.ts with the app's `@/` alias and runs it on node.
 *
 * esbuild ships with Vite, so the suite adds no dependency. The bundle is ESM
 * (the test file uses import.meta.url for its fixtures) and gets a tiny DOM
 * shim so browser-facing modules such as `@/lib/desktop` can be imported.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules', '.cache', 'msap-tests.mjs');

const shim = `
globalThis.window = globalThis;
globalThis.self = globalThis;
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node/msap-tests' };
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}
`;

await build({
  entryPoints: [path.join(root, 'tests', 'logic.test.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  alias: { '@': path.join(root, 'src') },
  define: {
    'import.meta.env.DEV': 'false',
    FIXTURE_DIR: JSON.stringify(path.join(root, 'tests', 'fixtures')),
  },
  banner: { js: shim },
  logLevel: 'warning',
});

execFileSync(process.execPath, [outfile], { stdio: 'inherit' });
