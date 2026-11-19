/**
 * One shared ONNX Runtime loader.
 *
 * `onnxruntime-web` needs three things to work on a phone that ships no CDN:
 *  1. the WebAssembly backend files served from our own origin (`/ort/…`),
 *  2. single threaded execution (SharedArrayBuffer is not available in a
 *     WebView without cross origin isolation),
 *  3. proxy disabled, otherwise the runtime spawns a worker that would need its
 *     own copy of the wasm module.
 *
 * The vite plugin `msap-onnx-wasm` emits those files for every build, so this
 * module only has to point the runtime at them.
 */

/**
 * The pure WebAssembly build (`onnxruntime-web/wasm`). The default entry also
 * bundles the WebGPU/JSEP backend, which makes the runtime ask for a `.jsep.mjs`
 * file we deliberately do not ship; this one only needs the two files under
 * `/ort/`.
 */
type OrtModule = typeof import('onnxruntime-web/wasm');

/** Matches the `onnxruntime-web` range in package.json. */
const FALLBACK_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';

let ortPromise: Promise<OrtModule> | null = null;
let configured = false;

/**
 * Where the runtime should look for its `.wasm`. A packaged desktop build loads
 * the renderer from `file://`, where Chromium refuses to fetch local binaries, so
 * that one case falls back to the CDN. Every other container — Android, iOS,
 * the web — is served by the app itself and stays fully offline.
 */
function localWasmBase(): string | null {
  if (location.protocol === 'file:') return null;
  return new URL('ort/', document.baseURI).href;
}

export async function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = (async () => {
      const ort = await import('onnxruntime-web/wasm');
      if (!configured) {
        configured = true;
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
        const base = localWasmBase();
        ort.env.wasm.wasmPaths = base ?? FALLBACK_CDN;
      }
      return ort;
    })().catch((error: unknown) => {
      ortPromise = null;
      configured = false;
      throw error;
    });
  }
  return ortPromise;
}

/** True when the WebAssembly backend is served by the app itself. */
export async function onnxRuntimeIsLocal(): Promise<boolean> {
  return localWasmBase() !== null;
}
