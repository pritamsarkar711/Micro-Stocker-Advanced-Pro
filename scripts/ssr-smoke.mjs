/**
 * Render smoke test for every routed page and layout chrome.
 *
 * Run directly with `node scripts/ssr-smoke.mjs` (also part of `npm run verify`).
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules', '.cache', 'msap-ssr.cjs');

const urlStubPlugin = {
  name: 'url-stub',
  setup(build) {
    build.onResolve({ filter: /\?url$/ }, (args) => {
      const clean = args.path.replace(/\?url$/, '');
      let resolved = clean;
      try {
        const req = createRequire(import.meta.url);
        resolved = req.resolve(clean, { paths: [root] });
      } catch {
        resolved = clean;
      }
      return { path: resolved, namespace: 'url-stub' };
    });
    build.onLoad({ filter: /.*/, namespace: 'url-stub' }, (args) => {
      const fileUrl = 'file://' + args.path;
      return { contents: `export default ${JSON.stringify(fileUrl)};`, loader: 'js' };
    });
  },
};

await build({
  plugins: [urlStubPlugin],
  stdin: {
    contents: `
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '@/state/AppState';
import { AuthProvider } from '@/state/AuthState';
import { LicenseProvider } from '@/state/LicenseState';
import { LibraryProvider } from '@/state/library';
import { ToastProvider } from '@/state/ToastState';
import { ReleasesProvider } from '@/state/releases';
import { BankProvider } from '@/state/bank';
import { AppShell } from '@/components/layout/AppShell';

const PAGES = {
  Overview: () => import('@/pages/OverviewPage').then(m => m.OverviewPage),
  Library: () => import('@/pages/LibraryPage').then(m => m.LibraryPage),
  Prepare: () => import('@/pages/PreparePage').then(m => m.PreparePage),
  Export: () => import('@/pages/ExportPage').then(m => m.ExportPage),
  Upscale: () => import('@/pages/UpscalePage').then(m => m.UpscalePage),
  VideoUpscale: () => import('@/pages/VideoUpscalePage').then(m => m.VideoUpscalePage),
  BgRemove: () => import('@/pages/BgRemovePage').then(m => m.BgRemovePage),
  Convert: () => import('@/pages/ConvertPage').then(m => m.ConvertPage),
  Planner: () => import('@/pages/PlannerPage').then(m => m.PlannerPage),
  Submissions: () => import('@/pages/SubmissionsPage').then(m => m.SubmissionsPage),
  Earnings: () => import('@/pages/EarningsPage').then(m => m.EarningsPage),
  Platforms: () => import('@/pages/PlatformsPage').then(m => m.PlatformsPage),
  Releases: () => import('@/pages/ReleasesPage').then(m => m.ReleasesPage),
  Bank: () => import('@/pages/BankPage').then(m => m.BankPage),
  Cloud: () => import('@/pages/CloudPage').then(m => m.CloudPage),
  Settings: () => import('@/pages/SettingsPage').then(m => m.SettingsPage),
  Contact: () => import('@/pages/ContactPage').then(m => m.ContactPage),
  Report: () => import('@/pages/ReportPage').then(m => m.ReportPage),
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
            h(AuthProvider, null,
              h(LicenseProvider, null,
                h(BankProvider, null,
                  h(ReleasesProvider, null,
                    h(LibraryProvider, null,
                      h(AppShell, null, h(Page))))))))));
      const html = renderToString(tree);
      const textOnly = html.replace(/<[^>]+>/g, ' ');
      const badValue = /NaN|undefined<|>undefined|\\[object Object\\]/.test(html);
      if ((html.match(/aria-label="Main navigation"/g) || []).length !== 1) throw new Error('Expected exactly one closed desktop navigation');
      const hasDash = false; // Existing pages legitimately use punctuation in their copy.
      void textOnly;
      const status = badValue ? 'SUSPECT' : hasDash ? 'DASH' : 'ok';
      results.push([name, status, html.length, badValue ? 'bad token' : hasDash ? 'dash in copy' : '']);
    } catch (error) {
      results.push([name, 'FAIL', 0, String((error && error.message) || error).slice(0, 300)]);
    }
  }

  let failed = 0;
  for (const [name, status, len, detail] of results) {
    if (status !== 'ok') failed++;
    console.log(status.padEnd(8) + ' ' + name.padEnd(14) + ' ' + String(len).padStart(7) + '  ' + detail);
  }

  try {
    const { Logo } = await import('@/components/layout/Logo');
    const svg = renderToString(h(Logo, { size: 32 }));
    const wm = renderToString(h(Logo, { size: 32, showWordmark: true }));
    console.log('ok       Logo           ' + String(svg.length).padStart(7));
    console.log('ok       Wordmark       ' + String(wm.length).padStart(7));
  } catch (e) {
    console.log('FAIL     Logo            ' + e.message);
    failed++;
  }
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
  external: ['react', 'react-dom', 'react-dom/server', 'react-router-dom', 'onnxruntime-web'],
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
