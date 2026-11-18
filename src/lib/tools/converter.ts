import { canEmbedFormat, embedMetadata, extractEmbeddedXmp } from '@/lib/stock/xmp';
import type { StockFormat } from '@/lib/stock/types';
import {
  decodeBytesAuto,
  detectImageFormat,
  encodeApng,
  encodeAvif,
  encodeBmp as encodeBmpPure,
  encodeCin,
  encodeCur,
  encodeDds,
  encodeDpx,
  encodeEps,
  encodeExr,
  encodeFarbfeld,
  encodeFits,
  encodeGif as encodeGifPure,
  encodeHdr,
  encodeIcns,
  encodeIco as encodeIcoPure,
  encodeIff,
  encodeJp2,
  encodeJpeg,
  encodeJxl,
  encodeKtx,
  encodeNetpbm,
  encodePcx,
  encodePdf,
  encodePfm,
  encodePng,
  encodePngIndexed,
  encodePsd,
  encodePsb,
  encodeQoi,
  encodeRas,
  encodeSgi,
  encodeSvg,
  encodeSvgz,
  encodeTga,
  encodeTiff as encodeTiffPure,
  encodeWbmp,
  encodeXbm,
  encodeXpm,
  encodeAi,
  type Raster,
} from './imageCodecs';

/**
 * Universal in app image format converter.
 *
 * Bidirectional decode and encode across web, stock, print, HDR, cinema,
 * desktop icon, classic and scientific families. Pure TypeScript codecs run
 * everywhere, WebAssembly codecs (JPEG XL, AVIF, JPEG 2000) load with
 * explicit binary initialization so they work from file:// in Electron,
 * and browser canvas covers WebP plus legacy fallbacks.
 */

export type ConvertFormat =
  | 'jpg'
  | 'png'
  | 'apng'
  | 'webp'
  | 'avif'
  | 'jxl'
  | 'jp2'
  | 'tiff'
  | 'bmp'
  | 'gif'
  | 'ico'
  | 'cur'
  | 'icns'
  | 'svg'
  | 'svgz'
  | 'eps'
  | 'pdf'
  | 'ai'
  | 'exr'
  | 'hdr'
  | 'pfm'
  | 'tga'
  | 'dds'
  | 'ktx'
  | 'dpx'
  | 'cin'
  | 'sgi'
  | 'iff'
  | 'pcx'
  | 'wbmp'
  | 'xbm'
  | 'xpm'
  | 'farbfeld'
  | 'pbm'
  | 'pgm'
  | 'ppm'
  | 'pam'
  | 'pnm'
  | 'ras'
  | 'fits'
  | 'psd'
  | 'psb'
  | 'qoi';

export interface ConvertFormatSpec {
  id: ConvertFormat;
  label: string;
  ext: string;
  mime: string;
  lossy: boolean;
  supportsAlpha: boolean;
  supportsXmp: boolean;
  tag: string;
}

export const CONVERT_FORMATS: ConvertFormatSpec[] = [
  { id: 'jpg', label: 'JPG', ext: 'jpg', mime: 'image/jpeg', lossy: true, supportsAlpha: false, supportsXmp: true, tag: 'All agencies' },
  { id: 'png', label: 'PNG', ext: 'png', mime: 'image/png', lossy: false, supportsAlpha: true, supportsXmp: true, tag: 'Lossless alpha' },
  { id: 'apng', label: 'APNG', ext: 'apng', mime: 'image/apng', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Animated PNG' },
  { id: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp', lossy: true, supportsAlpha: true, supportsXmp: true, tag: 'Compact web' },
  { id: 'avif', label: 'AVIF', ext: 'avif', mime: 'image/avif', lossy: true, supportsAlpha: true, supportsXmp: false, tag: 'Next gen HDR' },
  { id: 'jxl', label: 'JXL', ext: 'jxl', mime: 'image/jxl', lossy: true, supportsAlpha: true, supportsXmp: false, tag: 'JPEG XL' },
  { id: 'jp2', label: 'JP2', ext: 'jp2', mime: 'image/jp2', lossy: true, supportsAlpha: false, supportsXmp: false, tag: 'JPEG 2000' },
  { id: 'tiff', label: 'TIFF', ext: 'tiff', mime: 'image/tiff', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Shutterstock print' },
  { id: 'bmp', label: 'BMP', ext: 'bmp', mime: 'image/bmp', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Uncompressed' },
  { id: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif', lossy: false, supportsAlpha: true, supportsXmp: false, tag: '256 color' },
  { id: 'ico', label: 'ICO', ext: 'ico', mime: 'image/x-icon', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Multi size icon' },
  { id: 'cur', label: 'CUR', ext: 'cur', mime: 'image/x-icon', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Cursor' },
  { id: 'icns', label: 'ICNS', ext: 'icns', mime: 'image/x-icon', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'macOS icon' },
  { id: 'svg', label: 'SVG', ext: 'svg', mime: 'image/svg+xml', lossy: false, supportsAlpha: true, supportsXmp: true, tag: 'Vector wrapper' },
  { id: 'svgz', label: 'SVGZ', ext: 'svgz', mime: 'image/svg+xml', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Gzipped SVG' },
  { id: 'eps', label: 'EPS', ext: 'eps', mime: 'application/postscript', lossy: false, supportsAlpha: true, supportsXmp: true, tag: 'Print vector' },
  { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Document' },
  { id: 'ai', label: 'AI', ext: 'ai', mime: 'application/pdf', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Illustrator' },
  { id: 'exr', label: 'EXR', ext: 'exr', mime: 'image/x-exr', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'HDR VFX' },
  { id: 'hdr', label: 'HDR', ext: 'hdr', mime: 'image/vnd.radiance', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Radiance HDR' },
  { id: 'pfm', label: 'PFM', ext: 'pfm', mime: 'image/x-portable-floatmap', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Float map' },
  { id: 'tga', label: 'TGA', ext: 'tga', mime: 'image/x-tga', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Game texture' },
  { id: 'dds', label: 'DDS', ext: 'dds', mime: 'image/x-dds', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'DirectX' },
  { id: 'ktx', label: 'KTX', ext: 'ktx', mime: 'image/ktx', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'OpenGL' },
  { id: 'dpx', label: 'DPX', ext: 'dpx', mime: 'image/x-dpx', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Film scan' },
  { id: 'cin', label: 'CIN', ext: 'cin', mime: 'image/x-cineon', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Cineon film' },
  { id: 'sgi', label: 'SGI', ext: 'sgi', mime: 'image/x-sgi', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Workstation' },
  { id: 'iff', label: 'IFF', ext: 'iff', mime: 'image/x-iff', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Amiga ILBM' },
  { id: 'pcx', label: 'PCX', ext: 'pcx', mime: 'image/x-pcx', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Classic PC' },
  { id: 'wbmp', label: 'WBMP', ext: 'wbmp', mime: 'image/vnd.wap.wbmp', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Wireless bitmap' },
  { id: 'xbm', label: 'XBM', ext: 'xbm', mime: 'image/x-xbitmap', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'X bitmap' },
  { id: 'xpm', label: 'XPM', ext: 'xpm', mime: 'image/x-xpixmap', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'X pixmap' },
  { id: 'farbfeld', label: 'FF', ext: 'ff', mime: 'image/x-farbfeld', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Farbfeld' },
  { id: 'pbm', label: 'PBM', ext: 'pbm', mime: 'image/x-portable-bitmap', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Bilevel' },
  { id: 'pgm', label: 'PGM', ext: 'pgm', mime: 'image/x-portable-graymap', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Grayscale' },
  { id: 'ppm', label: 'PPM', ext: 'ppm', mime: 'image/x-portable-pixmap', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'RGB pixmap' },
  { id: 'pam', label: 'PAM', ext: 'pam', mime: 'image/x-portable-arbitrary-map', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Arbitrary map' },
  { id: 'pnm', label: 'PNM', ext: 'pnm', mime: 'image/x-portable-anymap', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Netpbm' },
  { id: 'ras', label: 'RAS', ext: 'ras', mime: 'image/x-cmu-raster', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Sun raster' },
  { id: 'fits', label: 'FITS', ext: 'fits', mime: 'image/fits', lossy: false, supportsAlpha: false, supportsXmp: false, tag: 'Astronomy' },
  { id: 'psd', label: 'PSD', ext: 'psd', mime: 'image/vnd.adobe.photoshop', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Photoshop' },
  { id: 'psb', label: 'PSB', ext: 'psb', mime: 'image/vnd.adobe.photoshop', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Large Photoshop' },
  { id: 'qoi', label: 'QOI', ext: 'qoi', mime: 'image/x-qoi', lossy: false, supportsAlpha: true, supportsXmp: false, tag: 'Quite OK' },
];

/** Decode-only input extensions (HEIC/HEIF, camera RAW, design ZIPs). */
export const DECODE_ONLY_EXTENSIONS = [
  'heic',
  'heif',
  'dng',
  'cr2',
  'cr3',
  'nef',
  'arw',
  'raf',
  'orf',
  'rw2',
  'pef',
  'srw',
  'raw',
  'zip',
  'sketch',
  'fig',
  'xd',
  'ora',
  'xcf',
  'jpeg',
  'jfif',
  'jpe',
  'tif',
  'dib',
  'lbm',
  'ff',
  'j2k',
] as const;

export const SUPPORTED_INPUT_EXTENSIONS: string[] = Array.from(
  new Set([
    ...CONVERT_FORMATS.map((f) => f.ext),
    ...CONVERT_FORMATS.map((f) => f.id),
    ...DECODE_ONLY_EXTENSIONS,
    'jpg',
    'png',
    'svg',
    'ico',
    'tiff',
    'bmp',
    'avif',
    'webp',
  ]),
);

export const ACCEPT_ATTRIBUTE = [
  'image/*',
  ...SUPPORTED_INPUT_EXTENSIONS.map((ext) => `.${ext}`),
  '.pdf',
  '.eps',
  '.ai',
  '.psd',
  '.psb',
  '.heic',
  '.heif',
  '.dng',
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
].join(',');

export function isSupportedInputExtension(ext: string): boolean {
  const clean = ext.toLowerCase().replace(/^\./, '');
  return SUPPORTED_INPUT_EXTENSIONS.includes(clean);
}

export function detectInputFormat(bytes: Uint8Array, name = ''): string {
  return detectImageFormat(bytes, name);
}

export interface ResizePreset {
  id: string;
  label: string;
  longEdge?: number;
  megapixels?: number;
  square?: number;
}

export const CONVERT_RESIZE_PRESETS: ResizePreset[] = [
  { id: 'original', label: 'Original size' },
  { id: 'stock25', label: 'Stock 25 MP', megapixels: 25 },
  { id: 'stock12', label: 'Stock 12 MP', megapixels: 12 },
  { id: '8k', label: '8K (7680 px)', longEdge: 7680 },
  { id: '4k', label: '4K (3840 px)', longEdge: 3840 },
  { id: 'fhd', label: 'Full HD (1920 px)', longEdge: 1920 },
  { id: 'sq2000', label: 'Square 2000 px', square: 2000 },
  { id: 'custom', label: 'Custom long edge' },
];

export interface ConvertOptions {
  format: ConvertFormat;
  quality: number; // 0.1 .. 1
  background: 'transparent' | 'white' | 'black' | 'custom';
  customBg?: string;
  resizePreset: string;
  customLongEdge?: number;
  preserveMetadata: boolean;
  /** Store PNG output as a 256 colour palette file when it is smaller. */
  palettePng?: boolean;
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: ConvertFormat;
  preservedXmp: boolean;
}

/* -------------------------------------------------------------------------- */
/* Re-exported pure encoders (backwards compatible with existing callers)     */
/* -------------------------------------------------------------------------- */

export function encodeBmp(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = true): Uint8Array {
  return encodeBmpPure(rgba, width, height, withAlpha);
}

export function encodeTiff(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = false): Uint8Array {
  return encodeTiffPure(rgba, width, height, withAlpha);
}

export function encodeIco(entries: Array<{ size: number; png: Uint8Array }>): Uint8Array {
  return encodeIcoPure(entries);
}

export function encodeGif(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = true): Uint8Array {
  return encodeGifPure(rgba, width, height, withAlpha);
}

/* -------------------------------------------------------------------------- */
/* Raster decode / encode registry                                            */
/* -------------------------------------------------------------------------- */

export async function decodeRaster(bytes: Uint8Array, name = ''): Promise<Raster> {
  try {
    return await decodeBytesAuto(bytes, name);
  } catch (codecError) {
    // Browser fallback for formats the pure/WASM registry does not cover
    // (notably WebP in browsers without a pure decoder, and SVG variants).
    if (typeof document !== 'undefined' && typeof createImageBitmap === 'function') {
      try {
        const mime = guessMime(name, bytes);
        const blob = new Blob([bytes.slice()], { type: mime });
        const bitmap = await createImageBitmap(blob);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas 2D context unavailable');
          ctx.drawImage(bitmap, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(imageData.data) };
        } finally {
          bitmap.close();
        }
      } catch {
        /* fall through to the codec error */
      }
    }
    throw codecError instanceof Error ? codecError : new Error(String(codecError));
  }
}

function guessMime(name: string, bytes: Uint8Array): string {
  const format = detectImageFormat(bytes, name);
  const spec = CONVERT_FORMATS.find((f) => f.id === format || f.ext === format);
  if (spec) return spec.mime;
  if (format === 'webp') return 'image/webp';
  if (format === 'heic' || format === 'heif') return 'image/heic';
  if (format === 'svg') return 'image/svg+xml';
  return 'image/png';
}

/**
 * Encode through the browser's own canvas codec. WebP has no pure JS encoder in
 * the bundle, and every supported Chromium build ships one natively.
 */
async function encodeCanvasRaster(
  raster: Raster,
  mime: string,
  quality?: number,
): Promise<Uint8Array> {
  const { width, height, data } = raster;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), Math.max(1, width), Math.max(1, height)), 0, 0);
    const blob = await canvas.convertToBlob(quality === undefined ? { type: mime } : { type: mime, quality });
    if (blob.type !== mime) throw new Error(`${mime} encoding is not available in this browser.`);
    return new Uint8Array(await blob.arrayBuffer());
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), canvas.width, canvas.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) throw new Error(`Could not encode ${mime}.`);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function encodeRaster(
  raster: Raster,
  format: ConvertFormat,
  quality = 0.92,
): Promise<Uint8Array> {
  const { width, height, data } = raster;
  const q = Math.max(0.1, Math.min(1, quality));
  switch (format) {
    case 'jpg':
      return encodeJpeg(data, width, height, q);
    case 'png':
      return encodePng(data, width, height);
    case 'apng':
      return encodeApng(data, width, height);
    case 'avif':
      return encodeAvif(raster, { quality: Math.round(q * 100), speed: 8 });
    case 'jxl':
      return encodeJxl(raster, { quality: Math.round(q * 100), effort: 7 });
    case 'jp2':
      return encodeJp2(raster);
    case 'tiff':
      return encodeTiffPure(data, width, height, true);
    case 'bmp':
      return encodeBmpPure(data, width, height, true);
    case 'gif':
      return encodeGifPure(data, width, height, true);
    case 'icns':
      return encodeIcns(data, width, height);
    case 'svg':
      return encodeSvg(data, width, height);
    case 'svgz':
      return encodeSvgz(data, width, height);
    case 'eps':
      return encodeEps(data, width, height);
    case 'pdf':
      return encodePdf(data, width, height);
    case 'ai':
      return encodeAi(data, width, height);
    case 'exr':
      return encodeExr(data, width, height);
    case 'hdr':
      return encodeHdr(data, width, height);
    case 'pfm':
      return encodePfm(data, width, height);
    case 'tga':
      return encodeTga(data, width, height);
    case 'dds':
      return encodeDds(data, width, height);
    case 'ktx':
      return encodeKtx(data, width, height);
    case 'dpx':
      return encodeDpx(data, width, height);
    case 'cin':
      return encodeCin(data, width, height);
    case 'sgi':
      return encodeSgi(data, width, height);
    case 'iff':
      return encodeIff(data, width, height);
    case 'pcx':
      return encodePcx(data, width, height);
    case 'wbmp':
      return encodeWbmp(data, width, height);
    case 'xbm':
      return encodeXbm(data, width, height);
    case 'xpm':
      return encodeXpm(data, width, height);
    case 'farbfeld':
      return encodeFarbfeld(data, width, height);
    case 'pbm':
      return encodeNetpbm(data, width, height, 'pbm');
    case 'pgm':
      return encodeNetpbm(data, width, height, 'pgm');
    case 'ppm':
      return encodeNetpbm(data, width, height, 'ppm');
    case 'pam':
      return encodeNetpbm(data, width, height, 'pam');
    case 'pnm':
      return encodeNetpbm(data, width, height, 'pnm');
    case 'ras':
      return encodeRas(data, width, height);
    case 'fits':
      return encodeFits(data, width, height);
    case 'psd':
      return encodePsd(data, width, height, false);
    case 'psb':
      return encodePsb(data, width, height);
    case 'qoi':
      return encodeQoi(data, width, height);
    case 'webp':
      return encodeCanvasRaster(raster, 'image/webp', q);
    case 'ico':
    case 'cur':
      throw new Error(`${format.toUpperCase()} needs the icon pipeline.`);
    default:
      throw new Error(`Unsupported output format: ${String(format)}.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Canvas pipeline, resizing and conversion driver                            */
/* -------------------------------------------------------------------------- */

function toSafeBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

function rasterToCanvas(raster: Raster): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, raster.width);
  canvas.height = Math.max(1, raster.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const imageData = new ImageData(new Uint8ClampedArray(raster.data), canvas.width, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function renderToCanvas(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  fillColor: string | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Browser could not encode ${mime}`));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

function canvasToRaster(canvas: HTMLCanvasElement): Raster {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(imageData.data) };
}

function computeOutputDimensions(
  srcW: number,
  srcH: number,
  options: ConvertOptions,
): { width: number; height: number } {
  if (options.format === 'ico' || options.format === 'cur') {
    const edge = Math.min(256, Math.max(16, Math.max(srcW, srcH)));
    return { width: edge, height: edge };
  }
  if (options.resizePreset === 'custom' && options.customLongEdge && options.customLongEdge > 0) {
    const ratio = options.customLongEdge / Math.max(srcW, srcH);
    return {
      width: Math.max(1, Math.round(srcW * ratio)),
      height: Math.max(1, Math.round(srcH * ratio)),
    };
  }
  const preset = CONVERT_RESIZE_PRESETS.find((p) => p.id === options.resizePreset);
  if (!preset || preset.id === 'original') return { width: srcW, height: srcH };
  if (preset.square) return { width: preset.square, height: preset.square };
  if (preset.longEdge) {
    const ratio = preset.longEdge / Math.max(srcW, srcH);
    return {
      width: Math.max(1, Math.round(srcW * ratio)),
      height: Math.max(1, Math.round(srcH * ratio)),
    };
  }
  if (preset.megapixels) {
    const srcMp = (srcW * srcH) / 1_000_000;
    const ratio = Math.sqrt(preset.megapixels / Math.max(0.01, srcMp));
    return {
      width: Math.max(1, Math.round(srcW * ratio)),
      height: Math.max(1, Math.round(srcH * ratio)),
    };
  }
  return { width: srcW, height: srcH };
}

export function buildConvertedFilename(sourceName: string, format: ConvertFormat): string {
  const spec = CONVERT_FORMATS.find((f) => f.id === format) ?? CONVERT_FORMATS[0];
  const dot = sourceName.lastIndexOf('.');
  const stem = dot > 0 ? sourceName.slice(0, dot) : sourceName;
  return `${stem}.${spec.ext}`;
}

export async function convertImageFile(
  file: Blob,
  sourceName: string,
  options: ConvertOptions,
): Promise<ConvertResult> {
  const spec = CONVERT_FORMATS.find((f) => f.id === options.format) ?? CONVERT_FORMATS[0];
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const decoded = await decodeRaster(sourceBytes, sourceName);

  const { width, height } = computeOutputDimensions(decoded.width, decoded.height, options);
  const forceOpaque = !spec.supportsAlpha;
  const fill =
    options.background === 'white' || (forceOpaque && options.background === 'transparent')
      ? '#ffffff'
      : options.background === 'black'
        ? '#000000'
        : options.background === 'custom'
          ? options.customBg || '#ffffff'
          : null;

  const sourceCanvas = rasterToCanvas(decoded);
  const canvas = renderToCanvas(sourceCanvas, width, height, fill);
  let outBlob: Blob;

  switch (options.format) {
    case 'jpg':
    case 'png':
    case 'webp': {
      // Prefer the pure/WASM registry for JPG/PNG so output is identical in
      // every browser; WebP uses the native canvas encoder.
      if (options.format === 'webp') {
        outBlob = await canvasToBlob(canvas, spec.mime, spec.lossy ? options.quality : undefined);
      } else {
        const raster = canvasToRaster(canvas);
        const encoded =
          options.format === 'png' && options.palettePng
            ? encodePngIndexed(raster.data, raster.width, raster.height, 256).bytes
            : await encodeRaster(raster, options.format, options.quality);
        outBlob = toSafeBlob(encoded, spec.mime);
      }
      break;
    }
    case 'avif': {
      try {
        const raster = canvasToRaster(canvas);
        outBlob = toSafeBlob(await encodeRaster(raster, 'avif', options.quality), spec.mime);
      } catch {
        const candidate = await canvasToBlob(canvas, 'image/avif', options.quality);
        if (candidate.type !== 'image/avif') {
          throw new Error('AVIF encoding requires a Chromium 120+ browser or the desktop app.');
        }
        outBlob = candidate;
      }
      break;
    }
    case 'ico':
    case 'cur': {
      const sizes = [16, 32, 48, 256].filter((s) => s <= Math.max(48, width));
      const entries: Array<{ size: number; png: Uint8Array }> = [];
      for (const s of sizes) {
        const iconCanvas = renderToCanvas(sourceCanvas, s, s, fill);
        const pngBlob = await canvasToBlob(iconCanvas, 'image/png');
        entries.push({ size: s, png: new Uint8Array(await pngBlob.arrayBuffer()) });
      }
      outBlob = toSafeBlob(
        options.format === 'ico' ? encodeIcoPure(entries) : encodeCur(entries),
        spec.mime,
      );
      break;
    }
    default: {
      const raster = canvasToRaster(canvas);
      outBlob = toSafeBlob(await encodeRaster(raster, options.format, options.quality), spec.mime);
      break;
    }
  }

  // Carry over embedded IPTC/XMP metadata when requested and supported.
  let preservedXmp = false;
  if (options.preserveMetadata && canEmbedFormat(options.format as StockFormat)) {
    try {
      const existing = extractEmbeddedXmp(sourceBytes);
      if (existing && (existing.title || existing.keywords.length)) {
        const dstBytes = new Uint8Array(await outBlob.arrayBuffer());
        const enriched = embedMetadata(dstBytes, options.format as StockFormat, existing);
        outBlob = toSafeBlob(enriched, spec.mime);
        preservedXmp = true;
      }
    } catch {
      /* preserve clean pixel output even if XMP copy fails */
    }
  }

  return {
    blob: outBlob,
    filename: buildConvertedFilename(sourceName, options.format),
    width: canvas.width,
    height: canvas.height,
    sizeBytes: outBlob.size,
    format: options.format,
    preservedXmp,
  };
}
