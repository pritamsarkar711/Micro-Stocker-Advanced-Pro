import type { StockMetadata } from './types';

/**
 * Embedded metadata engine (IPTC-core via XMP), pure TypeScript, no binaries.
 *
 * Supported containers
 *  JPEG  : APP1 segment "http://ns.adobe.com/xap/1.0/\0"  (replace or insert)
 *  PNG   : iTXt chunk with keyword "XML:com.adobe.xmp"    (replace or insert, CRC fixed)
 *  SVG   : <x:xmpmeta> packet inside <metadata>           (replace or insert)
 *  EPS   : plaintext XMP packet in the header             (replace or insert, best effort)
 *  AI    : legacy %!PS files like EPS; PDF-based AI files cannot be edited safely
 *  WebP  : existing "XMP " chunk replaced; adding a new one needs VP8X rewrite -> reported
 *
 * Adobe Stock, Shutterstock, Dreamstime, 123RF, Depositphotos, Getty and Alamy
 * all read these fields on ingest, so embedded files arrive pre-tagged.
 */

const XMP_NS = 'http://ns.adobe.com/xap/1.0/\0';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildXmpPacket(metadata: StockMetadata): string {
  const keywords = metadata.keywords
    .map((k) => `     <rdf:li>${escapeXml(k)}</rdf:li>`)
    .join('\n');
  // 2 KB of padding lets later tools edit in place without rewriting the file.
  const pad = ' '.repeat(2048);
  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="MicroStockerAdvancedPro/1.0">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '  <rdf:Description rdf:about=""',
    '    xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"',
    '    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">',
    `   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(metadata.title)}</rdf:li></rdf:Alt></dc:title>`,
    `   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(metadata.description)}</rdf:li></rdf:Alt></dc:description>`,
    '   <dc:subject>',
    '    <rdf:Bag>',
    keywords,
    '    </rdf:Bag>',
    '   </dc:subject>',
    metadata.categories[0] ? `   <photoshop:Category>${escapeXml(metadata.categories[0])}</photoshop:Category>` : '',
    `   <Iptc4xmpCore:CountryCode></Iptc4xmpCore:CountryCode>`,
    pad,
    '  </rdf:Description>',
    ' </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function parseXmpPacket(xml: string): Partial<StockMetadata> {
  const alt = (tag: string) => {
    const re = new RegExp(`<dc:${tag}>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)</rdf:li>[\\s\\S]*?</dc:${tag}>`);
    const m = xml.match(re);
    return m
      ? m[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
      : undefined;
  };
  const keywords: string[] = [];
  const bag = xml.match(/<dc:subject>[\s\S]*?<rdf:Bag>([\s\S]*?)<\/rdf:Bag>[\s\S]*?<\/dc:subject>/);
  if (bag) {
    for (const m of bag[1].matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g)) {
      keywords.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }
  }
  const category = xml.match(/<photoshop:Category>([\s\S]*?)<\/photoshop:Category>/)?.[1];
  return {
    title: alt('title'),
    description: alt('description'),
    keywords: keywords.length ? keywords : undefined,
    categories: category ? [category] : undefined,
  };
}

export function findPacket(text: string): [number, number] | null {
  const start = text.indexOf('<?xpacket begin');
  if (start === -1) return null;
  const end = text.indexOf('<?xpacket end', start);
  if (end === -1) return null;
  const close = text.indexOf('?>', end);
  return [start, close === -1 ? text.length : close + 2];
}

/* ----------------------------- CRC32 for PNG ----------------------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

/* --------------------------------- JPEG ---------------------------------- */
function embedJpeg(bytes: Uint8Array, packet: string): Uint8Array {
  const packetBytes = encoder.encode(packet);
  if (packetBytes.length + 2 + XMP_NS.length > 65533) throw new Error('XMP packet too large for a JPEG APP1 segment');
  let offset = 2; // after SOI
  let existing: [number, number] | null = null; // segment start incl. marker, end exclusive
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      const head = decoder.decode(bytes.subarray(offset + 4, offset + 4 + XMP_NS.length));
      if (head === XMP_NS) existing = [offset, offset + 2 + length];
    }
    if (marker === 0xda) break; // start of scan: stop searching
    offset += 2 + length;
  }

  const segment = new Uint8Array(2 + 2 + XMP_NS.length + packetBytes.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  const segLen = 2 + XMP_NS.length + packetBytes.length;
  segment[2] = (segLen >> 8) & 0xff;
  segment[3] = segLen & 0xff;
  segment.set(encoder.encode(XMP_NS), 4);
  segment.set(packetBytes, 4 + XMP_NS.length);

  if (existing) {
    const out = new Uint8Array(bytes.length - (existing[1] - existing[0]) + segment.length);
    out.set(bytes.subarray(0, existing[0]), 0);
    out.set(segment, existing[0]);
    out.set(bytes.subarray(existing[1]), existing[0] + segment.length);
    return out;
  }
  const out = new Uint8Array(bytes.length + segment.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(bytes.subarray(2), 2 + segment.length);
  return out;
}

/* --------------------------------- PNG ----------------------------------- */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(encoder.encode(type), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function embedPng(bytes: Uint8Array, packet: string): Uint8Array {
  const keyword = 'XML:com.adobe.xmp';
  // iTXt: keyword\0 compressionFlag(0) compressionMethod(0) lang\0 translatedKey\0 text
  const kw = encoder.encode(keyword);
  const packetBytes = encoder.encode(packet);
  const data = new Uint8Array(kw.length + 1 + 2 + 2 + packetBytes.length);
  data.set(kw, 0);
  data[kw.length] = 0;
  data[kw.length + 1] = 0;
  data[kw.length + 2] = 0;
  data[kw.length + 3] = 0;
  data[kw.length + 4] = 0;
  data.set(packetBytes, kw.length + 5);
  const chunk = pngChunk('iTXt', data);

  // walk chunks
  let offset = 8;
  let existing: [number, number] | null = null;
  let iendPos = bytes.length - 12;
  while (offset + 8 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    const len = view.getUint32(0);
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
    if (type === 'iTXt') {
      const kwEnd = bytes.indexOf(0, offset + 8);
      const name = decoder.decode(bytes.subarray(offset + 8, kwEnd));
      if (name === keyword) existing = [offset, offset + 12 + len];
    }
    if (type === 'IEND') iendPos = offset;
    offset += 12 + len;
  }

  if (existing) {
    const out = new Uint8Array(bytes.length - (existing[1] - existing[0]) + chunk.length);
    out.set(bytes.subarray(0, existing[0]), 0);
    out.set(chunk, existing[0]);
    out.set(bytes.subarray(existing[1]), existing[0] + chunk.length);
    return out;
  }
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, iendPos), 0);
  out.set(chunk, iendPos);
  out.set(bytes.subarray(iendPos), iendPos + chunk.length);
  return out;
}

/* ------------------------------ text formats ----------------------------- */
function embedText(text: string, packet: string, format: 'svg' | 'eps'): { text: string; ok: boolean } {
  const range = findPacket(text);
  if (range) {
    return { text: text.slice(0, range[0]) + packet + text.slice(range[1]), ok: true };
  }
  if (format === 'svg') {
    const m = text.match(/<svg[^>]*>/);
    if (!m || m.index === undefined) return { text, ok: false };
    const at = m.index + m[0].length;
    return { text: text.slice(0, at) + `\n<metadata>\n${packet}\n</metadata>\n` + text.slice(at), ok: true };
  }
  // EPS: put the packet right after the header comment block
  const lines = text.split('\n');
  let insertAt = 0;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].startsWith('%!PS') || lines[i].startsWith('%%')) insertAt = i + 1;
    else if (insertAt > 0) break;
  }
  lines.splice(insertAt, 0, `% XMP metadata packet (Micro Stocker Advanced Pro)`, packet);
  return { text: lines.join('\n'), ok: true };
}

/* -------------------------------- public API ------------------------------ */
export interface EmbedResult {
  bytes?: Uint8Array;
  text?: string;
  ok: boolean;
  message: string;
}

export function embedMetadata(
  bytes: Uint8Array,
  format: string,
  metadata: StockMetadata,
): EmbedResult {
  const packet = buildXmpPacket(metadata);
  try {
    switch (format) {
      case 'jpg':
        return { bytes: embedJpeg(bytes, packet), ok: true, message: 'XMP written into JPEG APP1 segment.' };
      case 'png':
        return { bytes: embedPng(bytes, packet), ok: true, message: 'XMP written into PNG iTXt chunk (CRC fixed).' };
      case 'webp': {
        const text = decoder.decode(bytes);
        if (text.includes('<x:xmpmeta')) {
          const range = findPacket(text)!;
          return { bytes: encoder.encode(text.slice(0, range[0]) + packet + text.slice(range[1])), ok: true, message: 'Existing WebP XMP chunk replaced.' };
        }
        return { ok: false, message: 'This WebP has no XMP chunk yet; adding one requires a VP8X rewrite. Export as PNG or JPG instead.' };
      }
      case 'svg': {
        const res = embedText(decoder.decode(bytes), packet, 'svg');
        return res.ok
          ? { text: res.text, ok: true, message: 'XMP inserted into SVG <metadata>.' }
          : { ok: false, message: 'No <svg> root found — not a valid SVG file.' };
      }
      case 'eps':
      case 'ai': {
        const text = decoder.decode(bytes);
        if (text.startsWith('%PDF')) {
          return { ok: false, message: 'PDF-based .ai files keep XMP in compressed streams. Re-save as EPS from Illustrator, or embed into the paired JPG/EPS.' };
        }
        const res = embedText(text, packet, 'eps');
        return { text: res.text, ok: res.ok, message: res.ok ? 'XMP packet written into the PostScript header.' : 'Could not locate a header to attach XMP.' };
      }
      default:
        return { ok: false, message: `Embedding into .${format} is not supported.` };
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function readEmbeddedMetadata(bytes: Uint8Array, format: string): Partial<StockMetadata> | null {
  try {
    if (format === 'jpg') {
      let offset = 2;
      while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (marker === 0xe1 && decoder.decode(bytes.subarray(offset + 4, offset + 4 + XMP_NS.length)) === XMP_NS) {
          const xml = decoder.decode(bytes.subarray(offset + 4 + XMP_NS.length, offset + 2 + length));
          return parseXmpPacket(xml);
        }
        if (marker === 0xda) break;
        offset += 2 + length;
      }
      return null;
    }
    if (format === 'png') {
      let offset = 8;
      while (offset + 8 <= bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
        const len = view.getUint32(0);
        const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
        if (type === 'iTXt') {
          const kwEnd = bytes.indexOf(0, offset + 8);
          if (decoder.decode(bytes.subarray(offset + 8, kwEnd)) === 'XML:com.adobe.xmp') {
            return parseXmpPacket(decoder.decode(bytes.subarray(offset + 8 + 'XML:com.adobe.xmp'.length + 5, offset + 8 + len)));
          }
        }
        if (type === 'IEND') break;
        offset += 12 + len;
      }
      return null;
    }
    const text = decoder.decode(bytes);
    const range = findPacket(text);
    return range ? parseXmpPacket(text.slice(range[0], range[1])) : null;
  } catch {
    return null;
  }
}
