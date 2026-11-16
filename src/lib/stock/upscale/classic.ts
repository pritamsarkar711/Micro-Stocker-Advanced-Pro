/**
 * Built in commercial safe image upscaling pipelines.
 * Runs locally in both desktop and browser with stepped high quality resampling
 * plus selectable luminance sharpening, artifact smoothing or Anime4K style
 * edge refinement.
 */

export type BuiltinFilterMode = 'lanczos-pro' | 'edge-crisp' | 'photo-restore' | 'anime4k-shader' | 'plain';

export interface ClassicOptions {
  scale?: 2 | 3 | 4;
  exactScale?: number;
  mode?: BuiltinFilterMode;
  outFormat: 'png' | 'jpg' | 'webp';
  quality?: number;
  onProgress?: (ratio: number, label: string) => void;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(cw, ch);
  const el = document.createElement('canvas');
  el.width = cw;
  el.height = ch;
  return el;
}

/** Fast 3x3 edge aware denoise for compressed JPEGs before enlarging. */
function applySoftDenoise(data: Uint8ClampedArray, w: number, h: number) {
  if (w * h > 16_000_000) return;
  const src = new Uint8ClampedArray(data);
  const threshold = 24;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (row + x) * 4;
      const r0 = src[idx];
      const g0 = src[idx + 1];
      const b0 = src[idx + 2];
      let rs = r0 * 4;
      let gs = g0 * 4;
      let bs = b0 * 4;
      let wt = 4;
      const neighbors = [idx - 4, idx + 4, idx - w * 4, idx + w * 4];
      for (let n = 0; n < 4; n++) {
        const ni = neighbors[n];
        const dr = Math.abs(src[ni] - r0);
        const dg = Math.abs(src[ni + 1] - g0);
        const db = Math.abs(src[ni + 2] - b0);
        if (dr + dg + db < threshold * 3) {
          rs += src[ni];
          gs += src[ni + 1];
          bs += src[ni + 2];
          wt++;
        }
      }
      data[idx] = (rs / wt) | 0;
      data[idx + 1] = (gs / wt) | 0;
      data[idx + 2] = (bs / wt) | 0;
    }
  }
}

/** Unsharp luminance kernel with halo protection for crisp microstock detail. */
function applyUnsharp(data: Uint8ClampedArray, w: number, h: number, strength: number, clampHalo: boolean) {
  if (strength <= 0 || w < 3 || h < 3 || w * h > 36_000_000) return;
  const src = new Uint8ClampedArray(data);
  const stride = w * 4;
  for (let y = 1; y < h - 1; y++) {
    const row = y * stride;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x * 4;
      if (src[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        const center = src[i + c];
        const n1 = src[i - 4 + c];
        const n2 = src[i + 4 + c];
        const n3 = src[i - stride + c];
        const n4 = src[i + stride + c];
        const blur = (n1 + n2 + n3 + n4) * 0.25;
        let next = center + (center - blur) * strength;
        if (clampHalo) {
          const lo = Math.min(center, n1, n2, n3, n4);
          const hi = Math.max(center, n1, n2, n3, n4);
          if (next < lo) next = lo;
          else if (next > hi) next = hi;
        }
        data[i + c] = clampByte(Math.round(next));
      }
    }
  }
}

export async function upscaleClassic(blob: Blob, options: ClassicOptions): Promise<Blob> {
  const { scale = 2, exactScale, mode = 'lanczos-pro', outFormat, quality = 0.94, onProgress } = options;
  const bitmap = await createImageBitmap(blob);

  try {
    let source: ImageBitmap | OffscreenCanvas | HTMLCanvasElement = bitmap;
    let width = bitmap.width;
    let height = bitmap.height;

    if (mode === 'photo-restore' && width * height <= 12_000_000) {
      const pre = makeCanvas(width, height);
      const pctx = pre.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
      pctx.drawImage(source as CanvasImageSource, 0, 0);
      const img = pctx.getImageData(0, 0, width, height);
      applySoftDenoise(img.data, width, height);
      pctx.putImageData(img, 0, 0);
      source = pre;
    }

    const totalFactor = exactScale ?? scale;
    const steps: number[] = [];
    if (totalFactor <= 1) {
      steps.push(totalFactor);
    } else {
      let remaining = totalFactor;
      while (remaining > 2.01) {
        steps.push(2);
        remaining /= 2;
      }
      steps.push(remaining);
    }

    for (let i = 0; i < steps.length; i++) {
      const factor = steps[i];
      const nextW = Math.max(1, Math.round(width * factor));
      const nextH = Math.max(1, Math.round(height * factor));
      const canvas = makeCanvas(nextW, nextH);
      const ctx = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D;
      if (outFormat === 'jpg' && i === steps.length - 1) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, nextW, nextH);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source as CanvasImageSource, 0, 0, nextW, nextH);

      const isLast = i === steps.length - 1;
      if (isLast && mode !== 'plain' && nextW * nextH <= 34_000_000) {
        const img = ctx.getImageData(0, 0, nextW, nextH);
        if (mode === 'lanczos-pro') applyUnsharp(img.data, nextW, nextH, 0.35, false);
        else if (mode === 'edge-crisp') applyUnsharp(img.data, nextW, nextH, 0.65, false);
        else if (mode === 'photo-restore') applyUnsharp(img.data, nextW, nextH, 0.42, true);
        else if (mode === 'anime4k-shader') applyUnsharp(img.data, nextW, nextH, 0.9, true);
        ctx.putImageData(img, 0, 0);
      }

      source = canvas;
      width = nextW;
      height = nextH;
      onProgress?.((i + 1) / steps.length, `Pass ${i + 1} of ${steps.length}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const finalCanvas = source as OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== 'undefined' && finalCanvas instanceof OffscreenCanvas) {
      return await finalCanvas.convertToBlob({ type: MIME[outFormat], quality });
    }
    return await new Promise<Blob>((resolve, reject) =>
      (finalCanvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
        MIME[outFormat],
        quality,
      ),
    );
  } finally {
    bitmap.close();
  }
}
