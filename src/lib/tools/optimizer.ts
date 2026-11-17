/**
 * Image Optimizer core.
 *
 * Re-encodes an already decoded raster at the smallest quality that keeps the
 * pixels visually identical, optionally downscaling to a long-edge cap. The
 * search is deterministic and pure (the encoder is injected) so it can be tested
 * without a canvas.
 */

export type OptimizeFormat = 'jpg' | 'webp' | 'avif' | 'png';

export interface RasterLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface OptimizeOptions {
  format: OptimizeFormat;
  /** Fixed quality (0.1 … 1). Ignored when `targetKB` is set. */
  quality?: number;
  /** Aim at or below this size in kilobytes. */
  targetKB?: number;
  /** Only ever downscales; never enlarges. */
  maxLongEdge?: number;
  /** Lowest quality the search may use. */
  qualityFloor?: number;
}

export interface OptimizeResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  quality: number;
  attempts: number;
  resized: boolean;
}

/** Area-averaging box downscale — cheap, artefact free, deterministic. */
export function downscaleRaster(raster: RasterLike, maxLongEdge: number): RasterLike {
  const longEdge = Math.max(raster.width, raster.height);
  if (!Number.isFinite(maxLongEdge) || maxLongEdge <= 0 || longEdge <= maxLongEdge) return raster;

  const ratio = maxLongEdge / longEdge;
  const width = Math.max(1, Math.round(raster.width * ratio));
  const height = Math.max(1, Math.round(raster.height * ratio));
  const out = new Uint8ClampedArray(width * height * 4);

  const xStep = raster.width / width;
  const yStep = raster.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * yStep);
    const y1 = Math.min(raster.height, Math.max(y0 + 1, Math.floor((y + 1) * yStep)));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * xStep);
      const x1 = Math.min(raster.width, Math.max(x0 + 1, Math.floor((x + 1) * xStep)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * raster.width + sx) * 4;
          r += raster.data[i];
          g += raster.data[i + 1];
          b += raster.data[i + 2];
          a += raster.data[i + 3];
          n += 1;
        }
      }
      const o = (y * width + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }

  return { width, height, data: out };
}

/**
 * Binary-search the highest quality that still fits `targetKB`. Lossless formats
 * (PNG) ignore quality, so they are encoded once.
 */
export async function optimizeRaster(
  raster: RasterLike,
  options: OptimizeOptions,
  encode: (raster: RasterLike, quality: number) => Promise<Uint8Array>,
): Promise<OptimizeResult> {
  const target = options.maxLongEdge ? downscaleRaster(raster, options.maxLongEdge) : raster;
  const resized = target.width !== raster.width || target.height !== raster.height;

  if (options.format === 'png' || (!options.targetKB && options.quality === undefined)) {
    const bytes = await encode(target, 1);
    return {
      bytes,
      width: target.width,
      height: target.height,
      quality: 1,
      attempts: 1,
      resized,
    };
  }

  if (!options.targetKB) {
    const quality = clampQuality(options.quality ?? 0.86, options.qualityFloor);
    const bytes = await encode(target, quality);
    return { bytes, width: target.width, height: target.height, quality, attempts: 1, resized };
  }

  const targetBytes = Math.max(1024, options.targetKB * 1024);
  const floor = clampQuality(options.qualityFloor ?? 0.4, undefined);
  let low = floor;
  let high = 1;
  let best: { bytes: Uint8Array; quality: number } | null = null;
  let attempts = 0;

  for (let i = 0; i < 7; i += 1) {
    const quality = (low + high) / 2;
    const bytes = await encode(target, quality);
    attempts += 1;
    if (bytes.byteLength <= targetBytes) {
      best = { bytes, quality };
      low = quality;
    } else {
      high = quality;
    }
    if (high - low < 0.012) break;
  }

  if (!best) {
    // Even the floor is too big: keep the smallest attempt we produced.
    const bytes = await encode(target, floor);
    attempts += 1;
    best = { bytes, quality: floor };
  }

  return {
    bytes: best.bytes,
    width: target.width,
    height: target.height,
    quality: best.quality,
    attempts,
    resized,
  };
}

function clampQuality(value: number, floor?: number): number {
  const low = floor ?? 0.1;
  return Math.max(low, Math.min(1, value));
}

/** Conservative quality guesses per format at "visually lossless" settings. */
export const DEFAULT_QUALITY: Record<OptimizeFormat, number> = {
  jpg: 0.86,
  webp: 0.88,
  avif: 0.62,
  png: 1,
};

export function suggestedFormat(hasAlpha: boolean, originalFormat: string): OptimizeFormat {
  if (hasAlpha) return originalFormat === 'png' ? 'png' : 'webp';
  if (originalFormat === 'jpg' || originalFormat === 'jpeg') return 'jpg';
  return 'webp';
}
