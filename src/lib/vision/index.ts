/**
 * Browser entry point for local image understanding.
 *
 * Decodes a Blob once (or rasterises an SVG), hands the pixels to the pure
 * analyser, and restores the true pixel dimensions (the analyser works on a
 * downsample).
 */
import { analysePixels, type ImageInsight } from './analyse';

async function insightFromBitmap(bitmap: ImageBitmap): Promise<ImageInsight | null> {
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
}

/** Rasterise SVG text so an illustration is measured on the pixels it draws. */
async function svgToBitmap(text: string): Promise<ImageBitmap | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  let url = '';
  try {
    const sized = text.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
      const cleaned = attrs
        .replace(/\s(width|height)=["'][^"']*["']/gi, '')
        .replace(/\sviewBox=["'][^"']*["']/i, '');
      return `<svg${cleaned} viewBox="0 0 1000 1000" width="1000" height="1000">`;
    });
    url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 900, 900);
    const bitmap = await createImageBitmap(canvas);
    return bitmap;
  } catch {
    return null;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

export async function analyseBlob(blob?: Blob | null): Promise<ImageInsight | null> {
  if (!blob || typeof createImageBitmap !== 'function') return null;
  if (!blob.type.startsWith('image/')) return null;

  if (blob.type.includes('svg')) {
    const fromVector = await svgToBitmap(await blob.text());
    if (!fromVector) return null;
    try {
      return await insightFromBitmap(fromVector);
    } finally {
      fromVector.close?.();
    }
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    return await insightFromBitmap(bitmap);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export type { ImageInsight } from './analyse';
export { analysePixels } from './analyse';
