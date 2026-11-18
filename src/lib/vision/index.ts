/**
 * Browser entry point for local image understanding.
 *
 * Decodes a Blob once, hands the pixels to the pure analyser, and restores the
 * true pixel dimensions (the analyser works on a downsample).
 */
import { analysePixels, type ImageInsight } from './analyse';

export async function analyseBlob(blob?: Blob | null): Promise<ImageInsight | null> {
  if (!blob || typeof createImageBitmap !== 'function') return null;
  if (!blob.type.startsWith('image/') || blob.type.includes('svg')) return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(8, Math.round(bitmap.width * scale));
    const height = Math.max(8, Math.round(bitmap.height * scale));
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const insight = analysePixels(data, width, height);
    const megapixels = (bitmap.width * bitmap.height) / 1_000_000;
    const ratio = bitmap.width / Math.max(1, bitmap.height);
    return {
      ...insight,
      width: bitmap.width,
      height: bitmap.height,
      megapixels: Number(megapixels.toFixed(2)),
      aspectRatio: Number(ratio.toFixed(3)),
      orientation: ratio > 1.06 ? 'landscape' : ratio < 0.94 ? 'portrait' : 'square',
    };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export type { ImageInsight } from './analyse';
export { analysePixels } from './analyse';
