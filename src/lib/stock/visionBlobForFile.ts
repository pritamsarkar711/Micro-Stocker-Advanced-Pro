/**
 * Best-effort raster preview for EPS files.
 *
 * A generic (non-embedded) EPS cannot be rendered without a PostScript
 * interpreter, but most files in the wild carry a TIFF or PNG preview, and
 * files produced by this app embed a PNG. This extracts whatever raster data
 * is present so vision analysis can see the artwork. Returns null when the
 * file has no usable preview — callers fall back to filename based metadata.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const IEND = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

function indexOfSequence(haystack: Uint8Array, needle: number[], from = 0): number {
  const limit = haystack.length - needle.length;
  outer: for (let i = from; i <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Decode the hex PNG payload this app embeds in its own EPS exports. */
function extractEmbeddedHexPng(bytes: Uint8Array): Blob | null {
  // Only scan the head of the file as ASCII — the marker always lives there.
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const match = /MSAP_PNG_HEX:([0-9a-f]+)/i.exec(head);
  if (!match) return null;
  const hex = match[1];
  if (hex.length < 64 || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  return new Blob([out], { type: 'image/png' });
}

/** Pull the first standalone PNG stream out of an EPS preview section. */
function extractPng(bytes: Uint8Array): Blob | null {
  const start = indexOfSequence(bytes, PNG_SIGNATURE);
  if (start < 0) return null;
  const endOfImage = indexOfSequence(bytes, IEND, start);
  if (endOfImage < 0) return null;
  const end = endOfImage + IEND.length;
  if (end - start < 64) return null;
  return new Blob([bytes.slice(start, end) as unknown as BlobPart], { type: 'image/png' });
}

/** Pull the first standalone JPEG stream out of an EPS preview section. */
function extractJpeg(bytes: Uint8Array): Blob | null {
  const start = indexOfSequence(bytes, JPEG_SIGNATURE);
  if (start < 0) return null;
  // JPEG ends with FF D9.
  let end = -1;
  for (let i = bytes.length - 2; i > start; i--) {
    if (bytes[i] === 0xd9 && bytes[i - 1] === 0xff) {
      end = i + 1;
      break;
    }
  }
  if (end < 0 || end - start < 128) return null;
  return new Blob([bytes.slice(start, end) as unknown as BlobPart], { type: 'image/jpeg' });
}

/** Rasterise an SVG blob into a PNG blob via a canvas. */
export async function rasterizeSvg(blob: Blob, maxEdge = 1000): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  let url = '';
  try {
    url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth || maxEdge;
    const height = image.naturalHeight || maxEdge;
    if (!width || !height) return null;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * Turn any file the Metadata Generator accepts into something a vision model
 * can actually look at. JPG/PNG pass through; SVG is rasterised; EPS yields
 * its embedded preview when one exists.
 */
export async function visionBlobForFile(file: File): Promise<Blob | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type.startsWith('image/')) {
    if (file.type.includes('svg')) return rasterizeSvg(file);
    return file;
  }
  if (ext === 'svg') return rasterizeSvg(file);
  if (ext === 'eps' || ext === 'ai') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return extractEmbeddedHexPng(bytes) ?? extractPng(bytes) ?? extractJpeg(bytes);
  }
  return null;
}
