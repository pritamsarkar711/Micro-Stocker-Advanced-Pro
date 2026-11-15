import type { StockFormat } from './types';

export const SUPPORTED_FORMATS: StockFormat[] = ['jpg', 'png', 'eps', 'ai', 'svg', 'webp'];
export const UPSCALABLE_FORMATS: StockFormat[] = ['jpg', 'png', 'webp'];

export function detectFormat(name: string): StockFormat | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpeg') return 'jpg';
  return (SUPPORTED_FORMATS as string[]).includes(ext) ? (ext as StockFormat) : null;
}

/** Vector dimensions from text headers (no raster decode needed). */
export function probeVectorDimensions(text: string, format: 'svg' | 'eps'): { width?: number; height?: number } {
  if (format === 'svg') {
    const svgTag = text.match(/<svg[^>]*>/)?.[0] ?? '';
    const width = svgTag.match(/width=["']([0-9.]+)(px)?["']/);
    const height = svgTag.match(/height=["']([0-9.]+)(px)?["']/);
    const viewBox = svgTag.match(/viewBox=["']\s*([0-9.eE+-]+)[\s,]+([0-9.eE+-]+)[\s,]+([0-9.eE+-]+)[\s,]+([0-9.eE+-]+)/);
    if (width && height) return { width: parseFloat(width[1]), height: parseFloat(height[1]) };
    if (viewBox) return { width: parseFloat(viewBox[3]), height: parseFloat(viewBox[4]) };
    return {};
  }
  const box = text.match(/%%BoundingBox:\s*(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)/);
  if (box) {
    return {
      width: Math.round(parseFloat(box[3]) - parseFloat(box[1])),
      height: Math.round(parseFloat(box[4]) - parseFloat(box[2])),
    };
  }
  return {};
}

/** Raster dimensions without pulling the whole image into memory twice. */
export async function probeRasterDimensions(blob: Blob): Promise<{ width?: number; height?: number }> {
  try {
    if ('createImageBitmap' in globalThis) {
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    }
  } catch {
    /* fall through to <img> */
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
