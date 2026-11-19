/**
 * Neural upscaling that runs inside a phone.
 *
 * The NCNN/Vulkan packs the desktop app uses can never execute in an Android
 * WebView, which is why phone users used to be told to move to a desktop. This
 * module runs a small ONNX super resolution graph through ONNX Runtime's
 * WebAssembly backend instead: no native binary, no Vulkan, no installer that
 * can fail. It is slower than the desktop packs, so the engine caps the area it
 * feeds to the network and lets the classic resampler finish the job.
 */
import { installedModelUrl, installModelInApp, readInstalledModelBytes } from '@/lib/modelStore';
import { loadOrt } from '@/lib/tools/onnx';
import type { ModelInstallSpec } from '@/lib/desktop';

export interface OnnxUpscaleRequest {
  modelId: string;
  fileName: string;
  url?: string;
  /** Native network scale (4 for the Real-ESRGAN compact graph). */
  scale: number;
  /** Tile edge in source pixels before scaling. */
  tile?: number;
  /** Context pixels kept around each tile so seams stay invisible. */
  overlap?: number;
  /** Extra downscale applied before inference to bound memory and time. */
  preScale?: number;
  onProgress?: (ratio: number, label: string) => void;
  isCanceled?: () => boolean;
  outFormat: 'png' | 'jpg' | 'webp';
  quality: number;
}

export class UpscaleCanceledError extends Error {
  canceled = true;
  constructor() {
    super('Upscale canceled');
    this.name = 'UpscaleCanceledError';
  }
}

type OrtSession = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: readonly number[] }>>;
};

const sessions = new Map<string, OrtSession>();

async function modelSourceFor(request: OnnxUpscaleRequest): Promise<Uint8Array | string> {
  const localUrl = await installedModelUrl(request.modelId, request.fileName);
  if (localUrl) return localUrl;
  try {
    return await readInstalledModelBytes(request.modelId, request.fileName);
  } catch {
    if (!request.url) throw new Error('Model file is missing. Install it again from the model list.');
    request.onProgress?.(0.06, 'Downloading the mobile model');
    const spec: ModelInstallSpec = {
      id: request.modelId,
      kind: 'image-upscale',
      primaryFile: request.fileName,
      approxBytes: 0,
      files: [{ url: request.url, name: request.fileName, label: 'Mobile neural model' }],
    };
    const installed = await installModelInApp(spec);
    if (!installed.ok) throw new Error(installed.error || 'Model install failed');
    const url = await installedModelUrl(request.modelId, request.fileName);
    if (url) return url;
    return readInstalledModelBytes(request.modelId, request.fileName);
  }
}

async function sessionFor(request: OnnxUpscaleRequest): Promise<OrtSession> {
  const cached = sessions.get(request.modelId);
  if (cached) return cached;
  const ort = await loadOrt();
  request.onProgress?.(0.14, 'Loading the neural engine');
  const source = await modelSourceFor(request);
  const session = (await ort.InferenceSession.create(source as Uint8Array, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })) as unknown as OrtSession;
  sessions.set(request.modelId, session);
  return session;
}

function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This device could not create a drawing surface.');
  return context;
}

/**
 * Runs the graph tile by tile and returns the upscaled bitmap blob.
 *
 * Tiles are clamped to the image edges and the overlapping margin is dropped
 * from each result, so the network never sees a hard border it would ring.
 */
export async function upscaleOnnxImage(blob: Blob, request: OnnxUpscaleRequest): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = request.scale;
  const tile = request.tile ?? 192;
  const overlap = request.overlap ?? 16;
  const preScale = request.preScale ?? 1;

  const srcW = Math.max(1, Math.round(bitmap.width * preScale));
  const srcH = Math.max(1, Math.round(bitmap.height * preScale));
  const source = canvas2d(srcW, srcH);
  source.imageSmoothingEnabled = true;
  source.imageSmoothingQuality = 'high';
  source.drawImage(bitmap, 0, 0, srcW, srcH);
  bitmap.close?.();
  const srcData = source.getImageData(0, 0, srcW, srcH).data;

  const outW = srcW * scale;
  const outH = srcH * scale;
  const target = canvas2d(outW, outH);
  const session = await sessionFor(request);
  const ort = await loadOrt();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const step = Math.max(32, tile - overlap * 2);
  const tilesX = Math.max(1, Math.ceil(srcW / step));
  const tilesY = Math.max(1, Math.ceil(srcH / step));
  const total = tilesX * tilesY;
  let done = 0;

  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      if (request.isCanceled?.()) throw new UpscaleCanceledError();
      const tw = Math.min(tile, srcW);
      const th = Math.min(tile, srcH);
      const x0 = Math.min(Math.max(0, tx * step), Math.max(0, srcW - tw));
      const y0 = Math.min(Math.max(0, ty * step), Math.max(0, srcH - th));

      const plane = tw * th;
      const tensor = new Float32Array(3 * plane);
      for (let y = 0; y < th; y += 1) {
        const row = ((y0 + y) * srcW + x0) * 4;
        const planeRow = y * tw;
        for (let x = 0; x < tw; x += 1) {
          const src = row + x * 4;
          const dst = planeRow + x;
          tensor[dst] = srcData[src] / 255;
          tensor[plane + dst] = srcData[src + 1] / 255;
          tensor[plane * 2 + dst] = srcData[src + 2] / 255;
        }
      }

      const outputs = await session.run({
        [inputName]: new ort.Tensor('float32', tensor, [1, 3, th, tw]),
      });
      const result = outputs[outputName];
      if (!result) throw new Error('The neural engine returned nothing.');
      const outTileW = tw * scale;
      const outTileH = th * scale;
      const offX = x0 === 0 ? 0 : overlap;
      const offY = y0 === 0 ? 0 : overlap;
      const keepW = Math.max(1, tw - offX - (x0 + tw >= srcW ? 0 : overlap));
      const keepH = Math.max(1, th - offY - (y0 + th >= srcH ? 0 : overlap));

      const patch = new ImageData(keepW * scale, keepH * scale);
      for (let y = 0; y < keepH * scale; y += 1) {
        const sy = y + offY * scale;
        for (let x = 0; x < keepW * scale; x += 1) {
          const sx = x + offX * scale;
          const si = sy * outTileW + sx;
          const di = (y * keepW * scale + x) * 4;
          patch.data[di] = Math.max(0, Math.min(255, result.data[si] * 255));
          patch.data[di + 1] = Math.max(0, Math.min(255, result.data[outTileW * outTileH + si] * 255));
          patch.data[di + 2] = Math.max(0, Math.min(255, result.data[outTileW * outTileH * 2 + si] * 255));
          patch.data[di + 3] = 255;
        }
      }

      // Draw through a small scratch canvas because putImageData ignores
      // transforms and would overwrite neighbours at fractional offsets.
      const scratch = canvas2d(patch.width, patch.height);
      scratch.putImageData(patch, 0, 0);
      target.drawImage(
        scratch.canvas,
        (x0 + offX) * scale,
        (y0 + offY) * scale,
        patch.width,
        patch.height,
      );

      done += 1;
      request.onProgress?.(0.18 + (done / total) * 0.66, `Neural pass ${done} of ${total}`);
    }
  }

  request.onProgress?.(0.86, 'Encoding the result');
  const type = request.outFormat === 'jpg' ? 'image/jpeg' : request.outFormat === 'webp' ? 'image/webp' : 'image/png';
  const encoded = await new Promise<Blob | null>((resolve) =>
    target.canvas.toBlob((value) => resolve(value), type, request.quality),
  );
  if (!encoded) throw new Error('The upscaled image could not be encoded.');
  return encoded;
}

/** True when this build can run ONNX graphs in the current container. */
export function onnxUpscaleAvailable(): boolean {
  return typeof WebAssembly === 'object' && typeof OffscreenCanvas !== 'undefined'
    ? true
    : typeof WebAssembly === 'object';
}
