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

// `base: './'` in production is required so the packaged Electron app can load
// the renderer from the filesystem (file://) instead of a web origin.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
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
          if (
            id.includes('@jsquash') ||
            id.includes('codec-openjpeg') ||
            id.includes('pdfjs-dist') ||
            id.includes('libraw-wasm') ||
            id.includes('heic-to') ||
            id.includes('ag-psd') ||
            id.includes('utif2') ||
            id.includes('jpeg-js')
          )
            return 'codecs';
          return 'vendor';
        },
      },
    },
  },
}));
