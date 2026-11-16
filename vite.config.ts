import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` in production is required so the packaged Electron app can load
// the renderer from the filesystem (file://) instead of a web origin.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss()],
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
