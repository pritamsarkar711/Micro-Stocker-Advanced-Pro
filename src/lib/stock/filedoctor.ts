/**
 * File Doctor — privacy & technical cleanup before submission.
 *
 *  - inspects JPEG segments: EXIF (incl. GPS), Photoshop IRB, ICC, XMP
 *  - strips EXIF/GPS (camera serials, lenses, GPS coordinates are a privacy
 *    leak and some platforms reject files with certain metadata)
 *  - optionally strips Photoshop IRB
 *  - keeps XMP (your keywords!) and the ICC profile
 *  - re-encodes raster images through an sRGB canvas at a target quality and
 *    iterates quality/scale down until the file fits a platform size cap
 *
 * Vectors are never touched (re-encoding an EPS would rasterise it).
 */

export interface JpegReport {
  isJpeg: boolean;
  hasExif: boolean;
  hasGps: boolean;
  hasIcc: boolean;
  hasXmp: boolean;
  hasPhotoshop: boolean;
  segments: number;
}

const XMP_NS = 'http://ns.adobe.com/xap/1.0/\0';
const dec = new TextDecoder('utf-8', { fatal: false });

export function inspectJpeg(bytes: Uint8Array): JpegReport {
  const report: JpegReport = {
    isJpeg: bytes[0] === 0xff && bytes[1] === 0xd8,
    hasExif: false,
    hasGps: false,
    hasIcc: false,
    hasXmp: false,
    hasPhotoshop: false,
    segments: 0,
  };
  if (!report.isJpeg) return report;

  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda) break; // start of scan
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const payload = bytes.subarray(offset + 4, offset + 2 + length);
    report.segments++;

    if (marker === 0xe1) {
      const head = dec.decode(payload.subarray(0, 6));
      if (head === 'Exif\0\0') {
        report.hasExif = true;
        report.hasGps = report.hasGps || exifHasGps(payload);
      } else if (dec.decode(payload.subarray(0, XMP_NS.length)) === XMP_NS) {
        report.hasXmp = true;
      }
    } else if (marker === 0xe2 && dec.decode(payload.subarray(0, 12)) === 'ICC_PROFILE\0') {
      report.hasIcc = true;
    } else if (marker === 0xed && dec.decode(payload.subarray(0, 14)) === 'Photoshop 3.0\0') {
      report.hasPhotoshop = true;
    }
    offset += 2 + length;
  }
  return report;
}

/** Walk IFD0 looking for the GPSInfo pointer (tag 0x8825). */
function exifHasGps(payload: Uint8Array): boolean {
  try {
    const tiff = payload.subarray(6);
    const little = tiff[0] === 0x49 && tiff[1] === 0x49;
    const read16 = (o: number) => (little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1]);
    const read32 = (o: number) =>
      little
        ? tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] << 24)
        : (tiff[o] << 24) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3];
    const ifd0 = read32(4);
    const count = read16(ifd0);
    for (let i = 0; i < count; i++) {
      const entry = ifd0 + 2 + i * 12;
      if (read16(entry) === 0x8825) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface StripResult {
  bytes: Uint8Array;
  removed: string[];
}

export function stripJpegMetadata(bytes: Uint8Array, options: { photoshop: boolean }): StripResult {
  const removed: string[] = [];
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return { bytes, removed };

  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      chunks.push(bytes.subarray(offset)); // scan + everything after
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const segment = bytes.subarray(offset, offset + 2 + length);
    const payload = bytes.subarray(offset + 4, offset + 2 + length);

    const isExif = marker === 0xe1 && dec.decode(payload.subarray(0, 6)) === 'Exif\0\0';
    const isXmp = marker === 0xe1 && dec.decode(payload.subarray(0, XMP_NS.length)) === XMP_NS;
    const isIrb = marker === 0xed && dec.decode(payload.subarray(0, 14)) === 'Photoshop 3.0\0';

    if (isExif) removed.push('EXIF/GPS');
    else if (isIrb && options.photoshop) removed.push('Photoshop IRB');
    else chunks.push(segment); // keeps XMP + ICC + everything else

    offset += 2 + length;
  }

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return { bytes: out, removed: Array.from(new Set(removed)) };
}

/* -------------------------------------------------------------------------- */
/* sRGB re-encode with size targeting                                          */
/* -------------------------------------------------------------------------- */

export interface ReencodeOptions {
  format: 'jpg' | 'png' | 'webp';
  quality: number;
  maxMB?: number;
  /** Optional long-edge cap (e.g. Freepik web panel 10 000 px). */
  maxEdge?: number;
}

export interface ReencodeResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  scale: number;
  iterations: number;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export async function reencodeRaster(blob: Blob, options: ReencodeOptions): Promise<ReencodeResult> {
  const bitmap = await createImageBitmap(blob);
  let scale = 1;
  if (options.maxEdge) {
    const edge = Math.max(bitmap.width, bitmap.height);
    if (edge > options.maxEdge) scale = options.maxEdge / edge;
  }

  let quality = options.quality;
  let iterations = 0;
  let out: Blob | null = null;
  let width = bitmap.width;
  let height = bitmap.height;

  for (;;) {
    iterations++;
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas =
      'OffscreenCanvas' in globalThis
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    out =
      canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type: MIME[options.format], quality })
        : await new Promise<Blob>((resolve, reject) =>
            (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), MIME[options.format], quality),
          );

    const overSize = options.maxMB ? out.size > options.maxMB * 1_048_576 : false;
    if (!overSize || iterations >= 12) break;
    if (quality > 0.62) quality = Math.max(0.5, quality - 0.08);
    else scale *= 0.92; // last resort: shrink slightly
  }

  bitmap.close();
  return { blob: out!, width, height, quality, scale, iterations };
}

export function doctorSummary(report: JpegReport): string[] {
  const tags: string[] = [];
  if (report.hasExif) tags.push('EXIF');
  if (report.hasGps) tags.push('GPS!');
  if (report.hasPhotoshop) tags.push('IRB');
  if (report.hasIcc) tags.push('ICC');
  if (report.hasXmp) tags.push('XMP');
  return tags;
}
