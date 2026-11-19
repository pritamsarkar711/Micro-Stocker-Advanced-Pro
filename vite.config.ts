import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Strict Content Security Policy for the packaged build.
 *
 * Dev is left alone because Vite injects an inline React refresh preamble and
 * talks to the HMR websocket. The production document only loads local assets,
 * so nothing inline is needed: no inline scripts, no remote code, no frames.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'msap-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

/**
 * ONNX Runtime ships its WebAssembly backend as separate files. If the app does
 * not serve them itself, ONNX Runtime silently pulls them from a third party
 * CDN: slow on mobile data, broken offline, and a "downloads code at runtime"
 * finding in a Play Store review. This plugin copies the exact binaries the
 * installed onnxruntime-web expects into `/ort/` for dev and into `dist/ort/`
 * for every build, so background removal runs fully offline.
 */
function onnxWasmAssets(): Plugin {
  // Only the plain WebAssembly backend: the app asks ONNX Runtime for the
  // `wasm` execution provider, so shipping the 20 MB JSEP/WebGPU build too
  // would double the download for nothing.
  const files = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
  const source = (name: string) =>
    fileURLToPath(new URL(`./node_modules/onnxruntime-web/dist/${name}`, import.meta.url));

  return {
    name: 'msap-onnx-wasm',
    configureServer(server) {
      server.middlewares.use('/ort', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!files.includes(name)) return next();
        void readFile(source(name))
          .then((data) => {
            res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
            res.setHeader('Content-Length', String(data.byteLength));
            res.setHeader('Cache-Control', 'public, max-age=86400');
            // A HEAD probe must not carry a body, or the browser aborts it.
            res.end(req.method === 'HEAD' ? undefined : data);
          })
          .catch(() => next());
      });
    },
    async generateBundle() {
      for (const name of files) {
        try {
          this.emitFile({ type: 'asset', fileName: `ort/${name}`, source: await readFile(source(name)) });
        } catch {
          /* optional variant that this onnxruntime build does not ship */
        }
      }
    },
  };
}

// `base: './'` in production is required so the packaged Electron app can load
// the renderer from the filesystem (file://) instead of a web origin.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), onnxWasmAssets()],
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 0.0.0.0 + allowedHosts so the app is reachable through the Arena live
    // preview proxy as well as from a phone on the same network (dev testing).
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Vite's default (Chrome 107-era baseline) compiles to ES2020, which is
    // what Electron's embedded Chromium and every evergreen browser support.
    target: 'es2020',
    sourcemap: false,
    // Lazy module boundaries (route-level) let the heavy chart/vendor code be
    // split out so the first paint stays small.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('onnxruntime-web')) return 'onnx';
          if (id.includes('@supabase')) return 'supabase';
          // Only the framework shell is hoisted into a shared vendor chunk.
          // Everything else keeps Rollup's default splitting, so heavy codec,
          // PDF and image libraries stay inside the lazy route chunks that
          // actually use them and never delay first paint.
          if (/(?:^|\/)node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge|zustand|sonner|lucide-react)\//.test(id)) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
}));
