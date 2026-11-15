/**
 * Built-in (non-AI) upscaler: high-quality canvas resampling applied in ≤2×
 * steps so a 4× enlargement stays sharp instead of going soft in one jump.
 * Works in the browser preview and in the desktop renderer alike.
 */
export interface ClassicOptions {
  scale: 2 | 3 | 4;
  outFormat: 'png' | 'jpg' | 'webp';
  quality?: number;
  onProgress?: (ratio: number, label: string) => void;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;

export async function upscaleClassic(blob: Blob, options: ClassicOptions): Promise<Blob> {
  const { scale, outFormat, quality = 0.92, onProgress } = options;
  const bitmap = await createImageBitmap(blob);
  let source: ImageBitmap | OffscreenCanvas | HTMLCanvasElement = bitmap;
  let width = bitmap.width;
  let height = bitmap.height;

  const steps = scale === 2 ? [2] : scale === 3 ? [2, 1.5] : [2, 2];
  for (let i = 0; i < steps.length; i++) {
    const factor = steps[i];
    const nextW = Math.round(width * factor);
    const nextH = Math.round(height * factor);
    const canvas =
      'OffscreenCanvas' in globalThis
        ? new OffscreenCanvas(nextW, nextH)
        : Object.assign(document.createElement('canvas'), { width: nextW, height: nextH });
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source as CanvasImageSource, 0, 0, nextW, nextH);
    source = canvas;
    width = nextW;
    height = nextH;
    onProgress?.((i + 1) / steps.length, `Resampling pass ${i + 1}/${steps.length}`);
    // keep the UI responsive between passes
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const out =
    source instanceof OffscreenCanvas
      ? await source.convertToBlob({ type: MIME[outFormat], quality })
      : await new Promise<Blob>((resolve, reject) =>
          (source as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
            MIME[outFormat],
            quality,
          ),
        );
  bitmap.close();
  return out;
}
