import type { StockFormat, StockMetadata } from './types';

/**
 * Lossless IPTC IIM and Adobe XMP metadata writer for JPEG, PNG, WebP, SVG and
 * EPS assets without touching compressed pixel streams.
 *
 * Marketplaces reading these packets automatically on upload:
 *  Shutterstock, Adobe Stock, Freepik, Getty Images & iStock, Alamy,
 *  Dreamstime, 123RF, Depositphotos, Pond5, VectorStock, Pixabay, Canva, Envato.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function canEmbedFormat(format: StockFormat): boolean {
  return format === 'jpg' || format === 'png' || format === 'webp' || format === 'svg' || format === 'eps';
}

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildXmpPacket(meta: StockMetadata, options?: { creator?: string; aiGenerated?: boolean }): string {
  const title = xmlEscape(meta.title.trim());
  const description = xmlEscape((meta.description || meta.title).trim());
  const keywords = meta.keywords.map((k) => k.trim()).filter(Boolean);
  const bag = keywords.map((k) => `          <rdf:li>${xmlEscape(k)}</rdf:li>`).join('\n');
  const creator = options?.creator ? xmlEscape(options.creator) : '';
  const digitalSource = options?.aiGenerated
    ? `\n      <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>`
    : '';

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Micro Stocker Advanced Pro</xmp:CreatorTool>
      <photoshop:Headline>${title}</photoshop:Headline>${digitalSource}
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt>
      </dc:title>
      <dc:description>
        <rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt>
      </dc:description>${
        creator
          ? `\n      <dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>`
          : ''
      }
      <dc:subject>
        <rdf:Bag>
${bag}
        </rdf:Bag>
      </dc:subject>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function iptcRecord(record: number, dataset: number, payload: Uint8Array): Uint8Array {
  const len = Math.min(payload.length, 0x7fff);
  const out = new Uint8Array(5 + len);
  out[0] = 0x1c;
  out[1] = record;
  out[2] = dataset;
  out[3] = (len >> 8) & 0xff;
  out[4] = len & 0xff;
  out.set(payload.subarray(0, len), 5);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildIptcApp13(meta: StockMetadata): Uint8Array {
  const records: Uint8Array[] = [
    iptcRecord(1, 90, new Uint8Array([0x1b, 0x25, 0x47])),
    iptcRecord(2, 0, new Uint8Array([0x00, 0x04])),
  ];
  const title = meta.title.trim();
  const description = (meta.description || meta.title).trim();
  if (title) {
    records.push(iptcRecord(2, 5, enc.encode(title.slice(0, 64))));
    records.push(iptcRecord(2, 105, enc.encode(title.slice(0, 256))));
  }
  if (description) {
    records.push(iptcRecord(2, 120, enc.encode(description.slice(0, 2000))));
  }
  for (const raw of meta.keywords) {
    const kw = raw.trim().slice(0, 64);
    if (kw) records.push(iptcRecord(2, 25, enc.encode(kw)));
  }
  const iim = concat(records);

  const header = enc.encode('Photoshop 3.0\0');
  const signature = enc.encode('8BIM');
  const resourceId = new Uint8Array([0x04, 0x04, 0x00, 0x00]);
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, iim.length, false);
  const pad = iim.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array(0);
  const body = concat([header, signature, resourceId, size, iim, pad]);
  return makeJpegSegment(0xed, body);
}

function buildXmpApp1(xmp: string): Uint8Array {
  const ns = enc.encode('http://ns.adobe.com/xap/1.0/\0');
  return makeJpegSegment(0xe1, concat([ns, enc.encode(xmp)]));
}

function makeJpegSegment(marker: number, body: Uint8Array): Uint8Array {
  const length = body.length + 2;
  if (length > 0xffff) throw new Error('Metadata packet exceeds the 64 KB JPEG segment cap.');
  const head = new Uint8Array([0xff, marker, (length >> 8) & 0xff, length & 0xff]);
  return concat([head, body]);
}

function startsWith(buf: Uint8Array, offset: number, ascii: string): boolean {
  if (offset + ascii.length > buf.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (buf[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

export function embedInJpeg(source: Uint8Array, meta: StockMetadata, options?: { aiGenerated?: boolean }): Uint8Array {
  if (source.length < 4 || source[0] !== 0xff || source[1] !== 0xd8) {
    throw new Error('Not a valid JPEG file.');
  }
  const xmp = buildXmpPacket(meta, options);
  const out: Uint8Array[] = [source.subarray(0, 2), buildXmpApp1(xmp), buildIptcApp13(meta)];

  let pos = 2;
  while (pos + 4 <= source.length && source[pos] === 0xff) {
    const marker = source[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(source.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    const segLen = (source[pos + 2] << 8) | source[pos + 3];
    if (segLen < 2 || pos + 2 + segLen > source.length) break;
    const bodyOffset = pos + 4;
    const isOldXmp = marker === 0xe1 && startsWith(source, bodyOffset, 'http://ns.adobe.com/xap/1.0/\0');
    const isOldIptc = marker === 0xed && startsWith(source, bodyOffset, 'Photoshop 3.0\0');
    if (!isOldXmp && !isOldIptc) {
      out.push(source.subarray(pos, pos + 2 + segLen));
    }
    pos += 2 + segLen;
  }
  out.push(source.subarray(pos));
  return concat(out);
}

/* ---------- PNG: iTXt "XML:com.adobe.xmp" chunk ---------- */

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
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = enc.encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)), false);
  return out;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function embedInPng(source: Uint8Array, meta: StockMetadata, options?: { aiGenerated?: boolean }): Uint8Array {
  if (source.length < 8 || !PNG_SIG.every((b, i) => source[i] === b)) {
    throw new Error('Not a valid PNG file.');
  }
  const keyword = enc.encode('XML:com.adobe.xmp');
  const xmpBytes = enc.encode(buildXmpPacket(meta, options));
  const itxtData = concat([keyword, new Uint8Array([0, 0, 0, 0, 0]), xmpBytes]);
  const itxtChunk = makePngChunk('iTXt', itxtData);

  const out: Uint8Array[] = [source.subarray(0, 8)];
  let pos = 8;
  let injected = false;
  while (pos + 12 <= source.length) {
    const view = new DataView(source.buffer, source.byteOffset + pos, 8);
    const length = view.getUint32(0, false);
    const type = dec.decode(source.subarray(pos + 4, pos + 8));
    const end = pos + 12 + length;
    if (end > source.length) break;
    const isOldXmp = type === 'iTXt' && startsWith(source, pos + 8, 'XML:com.adobe.xmp\0');
    if (!isOldXmp) out.push(source.subarray(pos, end));
    if (type === 'IHDR' && !injected) {
      out.push(itxtChunk);
      injected = true;
    }
    pos = end;
  }
  return concat(out);
}

/* ---------- WebP: Full RIFF VP8X + "XMP " chunk injection ---------- */

function makeRiffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const pad = data.length & 1;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(enc.encode(fourcc), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

function readWebpCanvasDims(chunks: Array<{ type: string; data: Uint8Array }>): {
  width: number;
  height: number;
  hasAlpha: boolean;
  hasIcc: boolean;
  hasExif: boolean;
  hasAnim: boolean;
} {
  let width = 1;
  let height = 1;
  let hasAlpha = false;
  let hasIcc = false;
  let hasExif = false;
  let hasAnim = false;

  for (const c of chunks) {
    if (c.type === 'ICCP') hasIcc = true;
    if (c.type === 'EXIF') hasExif = true;
    if (c.type === 'ANIM') hasAnim = true;
    if (c.type === 'ALPH') hasAlpha = true;
    if (c.type === 'VP8X' && c.data.length >= 10) {
      const flags = c.data[0];
      hasIcc ||= Boolean(flags & 0x20);
      hasAlpha ||= Boolean(flags & 0x10);
      hasExif ||= Boolean(flags & 0x08);
      hasAnim ||= Boolean(flags & 0x02);
      width = 1 + (c.data[4] | (c.data[5] << 8) | (c.data[6] << 16));
      height = 1 + (c.data[7] | (c.data[8] << 8) | (c.data[9] << 16));
    } else if (c.type === 'VP8 ' && c.data.length >= 10 && width === 1 && height === 1) {
      if (c.data[3] === 0x9d && c.data[4] === 0x01 && c.data[5] === 0x2a) {
        width = (c.data[6] | (c.data[7] << 8)) & 0x3fff;
        height = (c.data[8] | (c.data[9] << 8)) & 0x3fff;
      }
    } else if (c.type === 'VP8L' && c.data.length >= 5 && width === 1 && height === 1) {
      if (c.data[0] === 0x2f) {
        const b1 = c.data[1];
        const b2 = c.data[2];
        const b3 = c.data[3];
        const b4 = c.data[4];
        width = 1 + (b1 | ((b2 & 0x3f) << 8));
        height = 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
        hasAlpha ||= Boolean(b4 & 0x10);
      }
    }
  }
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    hasAlpha,
    hasIcc,
    hasExif,
    hasAnim,
  };
}

export function embedInWebp(source: Uint8Array, meta: StockMetadata, options?: { aiGenerated?: boolean }): Uint8Array {
  if (source.length < 12 || !startsWith(source, 0, 'RIFF') || !startsWith(source, 8, 'WEBP')) {
    throw new Error('Not a valid WebP file.');
  }

  const parsed: Array<{ type: string; data: Uint8Array }> = [];
  let pos = 12;
  while (pos + 8 <= source.length) {
    const type = dec.decode(source.subarray(pos, pos + 4));
    const len = new DataView(source.buffer, source.byteOffset + pos + 4, 4).getUint32(0, true);
    const dataEnd = Math.min(source.length, pos + 8 + len);
    parsed.push({ type, data: source.subarray(pos + 8, dataEnd) });
    pos += 8 + len + (len & 1);
  }

  const info = readWebpCanvasDims(parsed);
  let flags = 0x04; // XMP flag bit
  if (info.hasIcc) flags |= 0x20;
  if (info.hasAlpha) flags |= 0x10;
  if (info.hasExif) flags |= 0x08;
  if (info.hasAnim) flags |= 0x02;

  const vp8xPayload = new Uint8Array(10);
  const wMinus1 = Math.max(0, info.width - 1);
  const hMinus1 = Math.max(0, info.height - 1);
  vp8xPayload[0] = flags;
  vp8xPayload[4] = wMinus1 & 0xff;
  vp8xPayload[5] = (wMinus1 >> 8) & 0xff;
  vp8xPayload[6] = (wMinus1 >> 16) & 0xff;
  vp8xPayload[7] = hMinus1 & 0xff;
  vp8xPayload[8] = (hMinus1 >> 8) & 0xff;
  vp8xPayload[9] = (hMinus1 >> 16) & 0xff;

  const xmpBytes = enc.encode(buildXmpPacket(meta, options));
  const outChunks: Uint8Array[] = [makeRiffChunk('VP8X', vp8xPayload)];
  for (const chunk of parsed) {
    if (chunk.type === 'VP8X' || chunk.type === 'XMP ') continue;
    outChunks.push(makeRiffChunk(chunk.type, chunk.data));
  }
  outChunks.push(makeRiffChunk('XMP ', xmpBytes));

  const body = concat([enc.encode('WEBP'), ...outChunks]);
  const riffHead = new Uint8Array(8);
  riffHead.set(enc.encode('RIFF'), 0);
  new DataView(riffHead.buffer).setUint32(4, body.length, true);
  return concat([riffHead, body]);
}

/* ---------- SVG & EPS ---------- */

export function embedInSvg(source: Uint8Array, meta: StockMetadata, options?: { aiGenerated?: boolean }): Uint8Array {
  let text = dec.decode(source);
  const xmp = buildXmpPacket(meta, options);
  const block = `<metadata id="msap-xmp">${xmp}</metadata>`;
  text = text.replace(/<metadata[^>]*id="msap-xmp"[\s\S]*?<\/metadata>\s*/i, '');
  const openTag = text.match(/<svg\b[^>]*>/i);
  if (!openTag || openTag.index === undefined) throw new Error('Not a valid SVG document.');
  const insertAt = openTag.index + openTag[0].length;
  const updated = `${text.slice(0, insertAt)}\n${block}${text.slice(insertAt)}`;
  return enc.encode(updated);
}

export function embedInEps(source: Uint8Array, meta: StockMetadata, options?: { aiGenerated?: boolean }): Uint8Array {
  let text = dec.decode(source);
  text = text.replace(/%begin_xml_packet:[\s\S]*?%end_xml_packet\r?\n?/g, '');
  const xmp = buildXmpPacket(meta, options);
  const bytes = enc.encode(xmp).length;
  const block = `%begin_xml_packet: ${bytes}\n${xmp}\n%end_xml_packet\n`;
  const eof = text.lastIndexOf('%%EOF');
  const updated = eof >= 0 ? `${text.slice(0, eof)}${block}${text.slice(eof)}` : `${text}\n${block}`;
  return enc.encode(updated);
}

export function embedMetadata(
  source: Uint8Array,
  format: StockFormat,
  meta: StockMetadata,
  options?: { aiGenerated?: boolean },
): Uint8Array {
  switch (format) {
    case 'jpg':
      return embedInJpeg(source, meta, options);
    case 'png':
      return embedInPng(source, meta, options);
    case 'webp':
      return embedInWebp(source, meta, options);
    case 'svg':
      return embedInSvg(source, meta, options);
    case 'eps':
      return embedInEps(source, meta, options);
    default:
      throw new Error(
        `Convert ${format.toUpperCase()} to JPG, PNG or WebP first, or export a sidecar XMP packet.`,
      );
  }
}

/** Read back embedded XMP title, description and keywords for verification. */
export function extractEmbeddedXmp(bytes: Uint8Array): StockMetadata | null {
  const text = dec.decode(bytes);
  const start = text.indexOf('<x:xmpmeta');
  const end = text.indexOf('</x:xmpmeta>');
  if (start < 0 || end < 0) return null;
  const xml = text.slice(start, end + 12);
  const unescape = (s: string) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  const titleMatch = xml.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
  const descMatch = xml.match(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
  const bagMatch = xml.match(/<dc:subject>[\s\S]*?<rdf:Bag>([\s\S]*?)<\/rdf:Bag>/i);
  const keywords: string[] = [];
  if (bagMatch) {
    const re = /<rdf:li>([\s\S]*?)<\/rdf:li>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(bagMatch[1])) !== null) {
      const kw = unescape(m[1]).trim();
      if (kw) keywords.push(kw);
    }
  }
  return {
    title: titleMatch ? unescape(titleMatch[1]).trim() : '',
    description: descMatch ? unescape(descMatch[1]).trim() : '',
    keywords,
    categories: [],
  };
}

export function sidecarFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.xmp`;
}
