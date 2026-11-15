/**
 * Render smoke test for every routed page.
 *
 * `npm test` covers the domain layer; this covers the React tree. Each page is
 * rendered with react-dom/server inside the real providers, so a bad hook,
 * a missing guard or an undefined value shows up as a failure here instead of
 * as a blank screen in the app.
 *
 * Run directly with `node scripts/ssr-smoke.mjs` (also part of `npm run verify`).
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules', '.cache', 'msap-ssr.cjs');

await build({
  stdin: {
    contents: `

import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '@/state/AppState';
import { LibraryProvider } from '@/state/library';
import { ToastProvider } from '@/state/ToastState';
import { ReleasesProvider } from '@/state/releases';
import { BankProvider } from '@/state/bank';

const PAGES = {
  Overview: () => import('@/pages/OverviewPage').then(m => m.OverviewPage),
  Library: () => import('@/pages/LibraryPage').then(m => m.LibraryPage),
  Prepare: () => import('@/pages/PreparePage').then(m => m.PreparePage),
  Upscale: () => import('@/pages/UpscalePage').then(m => m.UpscalePage),
  Export: () => import('@/pages/ExportPage').then(m => m.ExportPage),
  Planner: () => import('@/pages/PlannerPage').then(m => m.PlannerPage),
  Platforms: () => import('@/pages/PlatformsPage').then(m => m.PlatformsPage),
  Releases: () => import('@/pages/ReleasesPage').then(m => m.ReleasesPage),
  Earnings: () => import('@/pages/EarningsPage').then(m => m.EarningsPage),
  Bank: () => import('@/pages/BankPage').then(m => m.BankPage),
  Cloud: () => import('@/pages/CloudPage').then(m => m.CloudPage),
  Settings: () => import('@/pages/SettingsPage').then(m => m.SettingsPage),
  About: () => import('@/pages/AboutPage').then(m => m.AboutPage),
  NotFound: () => import('@/pages/NotFoundPage').then(m => m.NotFoundPage),
};

(async () => {
const results = [];
for (const [name, load] of Object.entries(PAGES)) {
  try {
    const Page = await load();
    const tree = h(MemoryRouter, { initialEntries: ['/'] },
      h(ToastProvider, null,
        h(AppProvider, null,
          h(BankProvider, null,
            h(ReleasesProvider, null,
              h(LibraryProvider, null, h(Page)))))));
    const html = renderToString(tree);
    const bad = /NaN|undefined<|>undefined|\\[object Object\\]/.test(html);
    results.push([name, bad ? 'SUSPECT' : 'ok', html.length, bad ? html.slice(0, 240) : '']);
  } catch (error) {
    results.push([name, 'FAIL', 0, String(error && error.message || error).slice(0, 300)]);
  }
}
let failed = 0;
for (const [name, status, len, detail] of results) {
  if (status !== 'ok') failed++;
  console.log(status.padEnd(8) + ' ' + name.padEnd(11) + ' ' + String(len).padStart(6) + '  ' + detail);
}

// shell + logo render
try {
  const { Logo } = await import('@/components/layout/Logo');
  const svg = renderToString(h(Logo, { size: 32 }));
  console.log('logo      ok        ' + svg.length);
  const wm = renderToString(h(Logo, { size: 32, withWordmark: true }));
  console.log('wordmark  ok        ' + wm.length);
} catch (e) { console.log('logo      FAIL ' + e.message); failed++; }
process.exit(failed ? 1 : 0);
})();
`,
    resolveDir: root,
    loader: 'tsx',
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  jsx: 'automatic',
  alias: { '@': path.join(root, 'src') },
  external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom'],
  define: { 'import.meta.env': JSON.stringify({ MODE: 'test', DEV: false, PROD: true }) },
  logLevel: 'error',
  banner: {
    js: `
const store = new Map();
globalThis.window = globalThis;
globalThis.self = globalThis;
if (!('navigator' in globalThis)) Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node/ssr' }, configurable: true });
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k), clear: () => store.clear(), key: (i) => Array.from(store.keys())[i] ?? null, get length() { return store.size; } };
`,
  },
});

try {
  const out = execFileSync(process.execPath, [outfile], { encoding: 'utf8', stdio: 'pipe' });
  console.log(out.trim());
} catch (error) {
  console.log(error.stdout ?? '');
  console.error(error.stderr ?? '');
  process.exit(1);
}
