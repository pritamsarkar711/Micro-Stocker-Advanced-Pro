import * as pako from 'pako';
import { Buffer as BrowserBuffer } from 'buffer';
import jxlEncWasmUrl from '@jsquash/jxl/codec/enc/jxl_enc.wasm?url';
import jxlDecWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import avifEncWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import avifDecWasmUrl from '@jsquash/avif/codec/dec/avif_dec.wasm?url';
import openJpegWasmUrl from '@cornerstonejs/codec-openjpeg/wasm?url';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Pure TypeScript image codecs used by the universal converter.
 *
 * Every codec in this file works without a DOM, which lets the automated suite
 * round trip binary files in Node. Browser native and WebAssembly codecs are
 * orchestrated separately in converter.ts.
 */

export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const globalScope = globalThis as typeof globalThis & { Buffer?: typeof BrowserBuffer };
if (!globalScope.Buffer) globalScope.Buffer = BrowserBuffer;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

export function encodeText(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function decodeText(value: Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
  return textDecoder.decode(value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer));
}

export type ByteLike = Uint8Array | Uint8ClampedArray | number[] | ArrayLike<number>;

export function toBytes(value: ArrayBuffer | ByteLike): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return Uint8Array.from(value as ArrayLike<number>);
}

export function concatBytes(...parts: ByteLike[]): Uint8Array {
  const arrays = parts.map((part) => toBytes(part));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += BASE64[(n >> 18) & 63] + BASE64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64[n & 63] : '=';
  }
  return out;
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64.length; i++) lookup[BASE64.charCodeAt(i)] = i;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)] ?? -1;
    const c1 = lookup[clean.charCodeAt(i + 1)] ?? -1;
    const c2 = clean[i + 2] === '=' ? 0 : lookup[clean.charCodeAt(i + 2)] ?? -1;
    const c3 = clean[i + 3] === '=' ? 0 : lookup[clean.charCodeAt(i + 3)] ?? -1;
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) continue;
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out.push((n >> 16) & 255);
    if (clean[i + 2] !== '=') out.push((n >> 8) & 255);
    if (clean[i + 3] !== '=') out.push(n & 255);
  }
  return new Uint8Array(out);
}

export class ByteWriter {
  private buffer = new Uint8Array(1024);
  private view = new DataView(this.buffer.buffer);
  public length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(value: number) {
    this.ensure(1);
    this.view.setUint8(this.length++, value & 0xff);
    return this;
  }

  u16le(value: number) {
    this.ensure(2);
    this.view.setUint16(this.length, value, true);
    this.length += 2;
    return this;
  }

  u32le(value: number) {
    this.ensure(4);
    this.view.setUint32(this.length, value >>> 0, true);
    this.length += 4;
    return this;
  }

  i32le(value: number) {
    this.ensure(4);
    this.view.setInt32(this.length, value, true);
    this.length += 4;
    return this;
  }

  u16be(value: number) {
    this.ensure(2);
    this.view.setUint16(this.length, value, false);
    this.length += 2;
    return this;
  }

  u32be(value: number) {
    this.ensure(4);
    this.view.setUint32(this.length, value >>> 0, false);
    this.length += 4;
    return this;
  }

  i32be(value: number) {
    this.ensure(4);
    this.view.setInt32(this.length, value, false);
    this.length += 4;
    return this;
  }

  u64le(value: number) {
    this.u32le(value >>> 0);
    this.u32le(Math.floor(value / 0x100000000));
    return this;
  }

  u64be(value: number) {
    this.u32be(Math.floor(value / 0x100000000));
    this.u32be(value >>> 0);
    return this;
  }

  f32le(value: number) {
    this.ensure(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
    return this;
  }

  f32be(value: number) {
    this.ensure(4);
    this.view.setFloat32(this.length, value, false);
    this.length += 4;
    return this;
  }

  bytes(value: ByteLike) {
    const arr = toBytes(value);
    this.ensure(arr.length);
    this.buffer.set(arr, this.length);
    this.length += arr.length;
    return this;
  }

  ascii(value: string) {
    return this.bytes(encodeText(value));
  }

  zeros(count: number) {
    this.ensure(count);
    this.length += count;
    return this;
  }

  setU32le(offset: number, value: number) {
    this.view.setUint32(offset, value >>> 0, true);
    return this;
  }

  setU32be(offset: number, value: number) {
    this.view.setUint32(offset, value >>> 0, false);
    return this;
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

export class ByteReader {
  private readonly view: DataView;
  public pos = 0;

  constructor(public readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get remaining() {
    return this.data.length - this.pos;
  }

  get eof() {
    return this.pos >= this.data.length;
  }

  private need(count: number) {
    if (this.pos + count > this.data.length) throw new Error('Unexpected end of image file.');
  }

  seek(position: number) {
    this.pos = Math.max(0, Math.min(this.data.length, position));
    return this;
  }

  skip(count: number) {
    this.pos += count;
    return this;
  }

  u8() {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }

  u16le() {
    this.need(2);
    const value = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return value;
  }

  u32le() {
    this.need(4);
    const value = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return value;
  }

  i32le() {
    this.need(4);
    const value = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return value;
  }

  u16be() {
    this.need(2);
    const value = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return value;
  }

  u32be() {
    this.need(4);
    const value = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return value;
  }

  i32be() {
    this.need(4);
    const value = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return value;
  }

  u64le() {
    const low = this.u32le();
    const high = this.u32le();
    return low + high * 0x100000000;
  }

  u64be() {
    const high = this.u32be();
    const low = this.u32be();
    return low + high * 0x100000000;
  }

  f32le() {
    this.need(4);
    const value = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return value;
  }

  f32be() {
    this.need(4);
    const value = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return value;
  }

  bytes(count: number) {
    this.need(count);
    const value = this.data.subarray(this.pos, this.pos + count);
    this.pos += count;
    return value;
  }

  ascii(count: number) {
    return decodeText(this.bytes(count));
  }

  cstring() {
    const start = this.pos;
    while (this.pos < this.data.length && this.data[this.pos] !== 0) this.pos++;
    const value = decodeText(this.data.subarray(start, this.pos));
    if (this.pos < this.data.length) this.pos++;
    return value;
  }

  varint() {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.u8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error('Invalid variable length integer.');
  }
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function createRaster(width: number, height: number, data?: Uint8ClampedArray): Raster {
  return {
    width,
    height,
    data: data ?? new Uint8ClampedArray(width * height * 4),
  };
}

export function rasterFromRgba(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(data) };
}

export function sliceBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.slice();
}

export function rasterFromRgb(data: Uint8Array | Uint8ClampedArray, width: number, height: number): Raster {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 3) {
    out[i * 4] = data[p] ?? 0;
    out[i * 4 + 1] = data[p + 1] ?? 0;
    out[i * 4 + 2] = data[p + 2] ?? 0;
    out[i * 4 + 3] = 255;
  }
  return { width, height, data: out };
}

export function rasterFromGray(data: Uint8Array | Uint8ClampedArray, width: number, height: number): Raster {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const gray = data[i] ?? 0;
    out[i * 4] = gray;
    out[i * 4 + 1] = gray;
    out[i * 4 + 2] = gray;
    out[i * 4 + 3] = 255;
  }
  return { width, height, data: out };
}

export function rasterFromCanvas(canvas: HTMLCanvasElement): Raster {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(image.data) };
}

export function rasterFromImageBitmap(bitmap: ImageBitmap): Raster {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable.');
  context.drawImage(bitmap, 0, 0);
  return rasterFromCanvas(canvas);
}

export function rasterToRgb(raster: Raster): Uint8Array {
  const out = new Uint8Array(raster.width * raster.height * 3);
  for (let i = 0, p = 0; i < raster.data.length; i += 4, p += 3) {
    const alpha = raster.data[i + 3] / 255;
    out[p] = Math.round(raster.data[i] * alpha + 255 * (1 - alpha));
    out[p + 1] = Math.round(raster.data[i + 1] * alpha + 255 * (1 - alpha));
    out[p + 2] = Math.round(raster.data[i + 2] * alpha + 255 * (1 - alpha));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* PNG, APNG and JPEG                                                         */
/* -------------------------------------------------------------------------- */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export interface PngChunk {
  type: string;
  data: Uint8Array;
}

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = concatBytes(encodeText(type), data);
  const writer = new ByteWriter();
  writer.u32be(data.length).bytes(body).u32be(crc32(body));
  return writer.finish();
}

export function parsePngChunks(bytes: Uint8Array): PngChunk[] {
  if (!bytes.subarray(0, 8).every((byte, index) => byte === PNG_SIGNATURE[index])) {
    throw new Error('Invalid PNG signature.');
  }
  const reader = new ByteReader(bytes);
  reader.seek(8);
  const chunks: PngChunk[] = [];
  while (reader.remaining >= 12) {
    const length = reader.u32be();
    const type = reader.ascii(4);
    const data = reader.bytes(length);
    reader.u32be();
    chunks.push({ type, data });
    if (type === 'IEND') break;
  }
  return chunks;
}

export function encodePng(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.bytes(PNG_SIGNATURE);
  const ihdr = new ByteWriter();
  ihdr.u32be(width).u32be(height).u8(8).u8(6).u8(0).u8(0).u8(0);
  writer.bytes(pngChunk('IHDR', ihdr.finish()));
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  writer.bytes(pngChunk('IDAT', pako.deflate(raw, { level: 6 })));
  writer.bytes(pngChunk('IEND', new Uint8Array()));
  return writer.finish();
}

export interface IndexedPngResult {
  bytes: Uint8Array;
  colors: number;
  /** True when the artwork had no more colours than the palette could hold. */
  exact: boolean;
}

interface ColourBox {
  colours: number[];
  counts: number[];
  weight: number;
}

/**
 * Palette PNG (colour type 3, 8 bit). Flat artwork, logos, icons and
 * illustrations often drop 70 to 90 percent in size with no visible change,
 * because every pixel becomes a single palette index instead of four channels.
 * Colours beyond the palette are merged with median cut, and any transparency is
 * carried in a tRNS chunk next to the palette.
 */
export function encodePngIndexed(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors = 256,
): IndexedPngResult {
  const pixels = width * height;
  const keys = new Map<number, { r: number; g: number; b: number; a: number; count: number }>();
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    const a = rgba[o + 3];
    // Fully transparent pixels all share one key: their colour does not matter.
    const r = a === 0 ? 0 : rgba[o];
    const g = a === 0 ? 0 : rgba[o + 1];
    const b = a === 0 ? 0 : rgba[o + 2];
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const found = keys.get(key);
    if (found) found.count += 1;
    else keys.set(key, { r, g, b, a, count: 1 });
  }

  const exact = keys.size <= maxColors;
  let palette: { r: number; g: number; b: number; a: number }[];

  if (exact) {
    palette = Array.from(keys.values());
  } else {
    const entries = Array.from(keys.values());
    const boxes: ColourBox[] = [
      {
        colours: entries.map((_, index) => index),
        counts: entries.map((entry) => entry.count),
        weight: entries.reduce((total, entry) => total + entry.count, 0),
      },
    ];
    while (boxes.length < maxColors) {
      let target = -1;
      let widest = 0;
      let channel = 0;
      boxes.forEach((box, index) => {
        if (box.colours.length < 2) return;
        for (let c = 0; c < 3; c += 1) {
          let min = 255;
          let max = 0;
          for (const colourIndex of box.colours) {
            const entry = entries[colourIndex];
            const value = c === 0 ? entry.r : c === 1 ? entry.g : entry.b;
            if (value < min) min = value;
            if (value > max) max = value;
          }
          if (max - min > widest) {
            widest = max - min;
            target = index;
            channel = c;
          }
        }
      });
      if (target < 0 || widest === 0) break;
      const box = boxes[target];
      box.colours.sort((a, b) => {
        const ea = entries[a];
        const eb = entries[b];
        return (channel === 0 ? ea.r - eb.r : channel === 1 ? ea.g - eb.g : ea.b - eb.b);
      });
      const half = box.weight / 2;
      let running = 0;
      let split = 1;
      for (let i = 0; i < box.colours.length - 1; i += 1) {
        running += box.counts[i];
        if (running >= half) {
          split = Math.max(1, i + 1);
          break;
        }
      }
      const left = box.colours.slice(0, split);
      const right = box.colours.slice(split);
      if (!left.length || !right.length) break;
      const weightOf = (list: number[]) => list.reduce((total, index) => total + entries[index].count, 0);
      boxes.splice(
        target,
        1,
        { colours: left, counts: left.map((index) => entries[index].count), weight: weightOf(left) },
        { colours: right, counts: right.map((index) => entries[index].count), weight: weightOf(right) },
      );
    }

    palette = boxes.map((box) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let total = 0;
      for (const index of box.colours) {
        const entry = entries[index];
        r += entry.r * entry.count;
        g += entry.g * entry.count;
        b += entry.b * entry.count;
        a += entry.a * entry.count;
        total += entry.count;
      }
      const n = Math.max(1, total);
      return {
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
        a: Math.round(a / n),
      };
    });
  }

  const count = Math.min(palette.length, maxColors);
  palette = palette.slice(0, count);

  const lookup = new Map<number, number>();
  const nearest = (r: number, g: number, b: number, a: number) => {
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const cached = lookup.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i += 1) {
      const entry = palette[i];
      const dr = entry.r - r;
      const dg = entry.g - g;
      const db = entry.b - b;
      const da = (entry.a - a) * 2;
      const distance = dr * dr + dg * dg + db * db + da * da;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
        if (distance === 0) break;
      }
    }
    if (lookup.size < 200000) lookup.set(key, best);
    return best;
  };

  const indices = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    indices[i] = nearest(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]);
  }

  const writer = new ByteWriter();
  writer.bytes(PNG_SIGNATURE);
  const ihdr = new ByteWriter();
  ihdr.u32be(width).u32be(height).u8(8).u8(3).u8(0).u8(0).u8(0);
  writer.bytes(pngChunk('IHDR', ihdr.finish()));

  const plte = new Uint8Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    plte[i * 3] = palette[i].r;
    plte[i * 3 + 1] = palette[i].g;
    plte[i * 3 + 2] = palette[i].b;
  }
  writer.bytes(pngChunk('PLTE', plte));

  if (palette.some((entry) => entry.a < 255)) {
    const trns = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) trns[i] = palette[i].a;
    writer.bytes(pngChunk('tRNS', trns));
  }

  const raw = new Uint8Array(height * (1 + width));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width);
    // Up filter: palette indices of flat artwork repeat vertically, so the
    // difference stream deflates far better than raw indices.
    raw[row] = 2;
    for (let x = 0; x < width; x += 1) {
      const value = indices[y * width + x];
      const above = y === 0 ? 0 : indices[(y - 1) * width + x];
      raw[row + 1 + x] = (value - above) & 0xff;
    }
  }
  writer.bytes(pngChunk('IDAT', pako.deflate(raw, { level: 9 })));
  writer.bytes(pngChunk('IEND', new Uint8Array()));
  return { bytes: writer.finish(), colors: count, exact };
}

function pngSample(row: Uint8Array, sampleIndex: number, bitDepth: number): number {
  if (bitDepth === 8) return row[sampleIndex];
  if (bitDepth === 16) return (row[sampleIndex * 2] << 8) | row[sampleIndex * 2 + 1];
  const bitIndex = sampleIndex * bitDepth;
  const shift = 8 - bitDepth - (bitIndex & 7);
  const mask = (1 << bitDepth) - 1;
  return (row[bitIndex >> 3] >> shift) & mask;
}

function scaleSample(value: number, bitDepth: number): number {
  const max = (1 << bitDepth) - 1;
  return bitDepth === 16 ? Math.round(value / 257) : Math.round((value * 255) / Math.max(1, max));
}

export function decodePng(bytes: Uint8Array): Raster {
  const chunks = parsePngChunks(bytes);
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr) throw new Error('PNG has no IHDR chunk.');
  const reader = new ByteReader(ihdr.data);
  const width = reader.u32be();
  const height = reader.u32be();
  const bitDepth = reader.u8();
  const colorType = reader.u8();
  const compression = reader.u8();
  const filterMethod = reader.u8();
  const interlace = reader.u8();
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error('Only non interlaced PNG images with standard filters are supported.');
  }
  const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channelCount = channels[colorType];
  if (!channelCount) throw new Error(`Unsupported PNG color type ${colorType}.`);
  const paletteChunk = chunks.find((chunk) => chunk.type === 'PLTE');
  const transparency = chunks.find((chunk) => chunk.type === 'tRNS');
  const idatParts = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (!idatParts.length) {
    for (const chunk of chunks) {
      if (chunk.type === 'fdAT' && chunk.data.length >= 4) idatParts.push(chunk.data.subarray(4));
      if (chunk.type === 'fcTL') break;
    }
  }
  if (!idatParts.length) throw new Error('PNG has no pixel data.');
  const inflated = pako.inflate(concatBytes(...idatParts));
  const rowBytes = Math.ceil((width * channelCount * bitDepth) / 8);
  const bytesPerPixel = Math.max(1, Math.ceil((channelCount * bitDepth) / 8));
  const data = new Uint8ClampedArray(width * height * 4);
  let previous = new Uint8Array(rowBytes);
  let sourceOffset = 0;
  const palette = paletteChunk ? paletteChunk.data : new Uint8Array();
  for (let y = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    const row = new Uint8Array(inflated.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;
    for (let x = 0; x < row.length; x++) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}.`);
      }
      row[x] = (row[x] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      const sampleBase = x * channelCount;
      if (colorType === 0) {
        const gray = scaleSample(pngSample(row, sampleBase, bitDepth), bitDepth);
        const transparentGray = transparency && transparency.data.length >= 2
          ? (transparency.data[0] << 8) | transparency.data[1]
          : -1;
        const rawGray = pngSample(row, sampleBase, bitDepth);
        data[out] = gray;
        data[out + 1] = gray;
        data[out + 2] = gray;
        data[out + 3] = rawGray === transparentGray ? 0 : 255;
      } else if (colorType === 2) {
        const r = scaleSample(pngSample(row, sampleBase, bitDepth), bitDepth);
        const g = scaleSample(pngSample(row, sampleBase + 1, bitDepth), bitDepth);
        const b = scaleSample(pngSample(row, sampleBase + 2, bitDepth), bitDepth);
        const transparent = transparency && transparency.data.length >= 6;
        const tr = transparent ? (transparency.data[0] << 8) | transparency.data[1] : -1;
        const tg = transparent ? (transparency.data[2] << 8) | transparency.data[3] : -1;
        const tb = transparent ? (transparency.data[4] << 8) | transparency.data[5] : -1;
        data[out] = r;
        data[out + 1] = g;
        data[out + 2] = b;
        data[out + 3] = transparent && tr === r * 257 && tg === g * 257 && tb === b * 257 ? 0 : 255;
      } else if (colorType === 3) {
        const index = pngSample(row, sampleBase, bitDepth);
        data[out] = palette[index * 3] ?? 0;
        data[out + 1] = palette[index * 3 + 1] ?? 0;
        data[out + 2] = palette[index * 3 + 2] ?? 0;
        data[out + 3] = transparency?.data[index] ?? 255;
      } else if (colorType === 4) {
        const gray = scaleSample(pngSample(row, sampleBase, bitDepth), bitDepth);
        const alpha = scaleSample(pngSample(row, sampleBase + 1, bitDepth), bitDepth);
        data[out] = gray;
        data[out + 1] = gray;
        data[out + 2] = gray;
        data[out + 3] = alpha;
      } else {
        data[out] = scaleSample(pngSample(row, sampleBase, bitDepth), bitDepth);
        data[out + 1] = scaleSample(pngSample(row, sampleBase + 1, bitDepth), bitDepth);
        data[out + 2] = scaleSample(pngSample(row, sampleBase + 2, bitDepth), bitDepth);
        data[out + 3] = scaleSample(pngSample(row, sampleBase + 3, bitDepth), bitDepth);
      }
    }
    previous = row;
  }
  return { width, height, data };
}

export function encodeApng(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const chunks = parsePngChunks(encodePng(rgba, width, height));
  const writer = new ByteWriter();
  writer.bytes(PNG_SIGNATURE);
  const acTL = new ByteWriter();
  acTL.u32be(1).u32be(0);
  const fcTL = new ByteWriter();
  fcTL.u32be(0).u32be(width).u32be(height).u32be(0).u32be(0).u16be(0).u16be(10).u8(0).u8(0);
  let inserted = false;
  for (const chunk of chunks) {
    if (!inserted && chunk.type === 'IDAT') {
      writer.bytes(pngChunk('acTL', acTL.finish()));
      writer.bytes(pngChunk('fcTL', fcTL.finish()));
      inserted = true;
    }
    writer.bytes(pngChunk(chunk.type, chunk.data));
  }
  return writer.finish();
}

async function jpegJs() {
  return import('jpeg-js');
}

export async function encodeJpeg(rgba: Uint8ClampedArray, width: number, height: number, quality = 0.92): Promise<Uint8Array> {
  const jpeg = await jpegJs();
  const encoded = jpeg.encode(
    { data: new Uint8Array(rgba), width, height },
    Math.max(1, Math.min(100, Math.round(quality * 100))),
  );
  return new Uint8Array(encoded.data);
}

export async function decodeJpeg(bytes: Uint8Array): Promise<Raster> {
  const jpeg = await jpegJs();
  const result = (jpeg as unknown as {
    decode: (data: Uint8Array, options: { useTArray: boolean; formatAsRGBA: boolean }) => { width: number; height: number; data: Uint8Array };
  }).decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: result.width, height: result.height, data: new Uint8ClampedArray(result.data) };
}

/** Encode RGBA pixel data into a standard 24 bit or 32 bit BMP buffer. */
export function encodeBmp(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = true): Uint8Array {
  const bpp = withAlpha ? 32 : 24;
  const rowBytes = withAlpha ? width * 4 : ((width * 3 + 3) & ~3);
  const pixelBytes = rowBytes * height;
  const headerBytes = 14 + 40;
  const out = new Uint8Array(headerBytes + pixelBytes);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // B
  out[1] = 0x4d; // M
  view.setUint32(2, out.length, true);
  view.setUint32(10, headerBytes, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom up for universal compatibility
  view.setUint16(26, 1, true);
  view.setUint16(28, bpp, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 11811, true); // 300 DPI
  view.setInt32(42, 11811, true);

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    const dstRow = headerBytes + y * rowBytes;
    if (withAlpha) {
      for (let x = 0; x < width; x++) {
        const s = srcRow + x * 4;
        const d = dstRow + x * 4;
        out[d] = rgba[s + 2];
        out[d + 1] = rgba[s + 1];
        out[d + 2] = rgba[s];
        out[d + 3] = rgba[s + 3];
      }
    } else {
      for (let x = 0; x < width; x++) {
        const s = srcRow + x * 4;
        const d = dstRow + x * 3;
        out[d] = rgba[s + 2];
        out[d + 1] = rgba[s + 1];
        out[d + 2] = rgba[s];
      }
    }
  }
  return out;
}

/** Encode RGBA pixel data into a baseline TIFF 6.0 file at 300 DPI. */
export function encodeTiff(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = false): Uint8Array {
  const samples = withAlpha ? 4 : 3;
  const pixelBytes = width * height * samples;
  const entryCount = withAlpha ? 12 : 11;
  const ifdOffset = 8;
  const ifdSize = 2 + entryCount * 12 + 4;
  const extraOffset = ifdOffset + ifdSize;
  // bitsPerSample (samples * 2 padded to 8) + xRes (8) + yRes (8)
  const bpsOffset = extraOffset;
  const xResOffset = extraOffset + 8;
  const yResOffset = extraOffset + 16;
  const dataOffset = extraOffset + 24;

  const out = new Uint8Array(dataOffset + pixelBytes);
  const view = new DataView(out.buffer);

  // Little endian TIFF header
  out[0] = 0x49;
  out[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);
  view.setUint16(ifdOffset, entryCount, true);

  let cursor = ifdOffset + 2;
  const writeTag = (tag: number, type: number, count: number, valueOrOffset: number) => {
    view.setUint16(cursor, tag, true);
    view.setUint16(cursor + 2, type, true);
    view.setUint32(cursor + 4, count, true);
    if (type === 3 && count === 1) view.setUint16(cursor + 8, valueOrOffset, true);
    else view.setUint32(cursor + 8, valueOrOffset, true);
    cursor += 12;
  };

  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  writeTag(258, 3, samples, bpsOffset); // BitsPerSample
  writeTag(259, 3, 1, 1); // Compression = None
  writeTag(262, 3, 1, 2); // PhotometricInterpretation = RGB
  writeTag(273, 4, 1, dataOffset); // StripOffsets
  writeTag(277, 3, 1, samples); // SamplesPerPixel
  writeTag(278, 4, 1, height); // RowsPerStrip
  writeTag(279, 4, 1, pixelBytes); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  if (withAlpha) writeTag(338, 3, 1, 2); // ExtraSamples = unassociated alpha
  view.setUint32(cursor, 0, true); // next IFD = 0

  for (let i = 0; i < samples; i++) view.setUint16(bpsOffset + i * 2, 8, true);
  view.setUint32(xResOffset, 300, true);
  view.setUint32(xResOffset + 4, 1, true);
  view.setUint32(yResOffset, 300, true);
  view.setUint32(yResOffset + 4, 1, true);

  if (withAlpha) {
    out.set(rgba, dataOffset);
  } else {
    let p = dataOffset;
    for (let i = 0; i < rgba.length; i += 4) {
      out[p++] = rgba[i];
      out[p++] = rgba[i + 1];
      out[p++] = rgba[i + 2];
    }
  }
  return out;
}

/** Pack one or more PNG buffers into a valid multi resolution Windows ICO file. */
export function encodeIco(entries: Array<{ size: number; png: Uint8Array }>): Uint8Array {
  const count = entries.length;
  const dirBytes = 6 + count * 16;
  const total = dirBytes + entries.reduce((sum, e) => sum + e.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = ICO
  view.setUint16(4, count, true);

  let offset = dirBytes;
  entries.forEach((entry, idx) => {
    const pos = 6 + idx * 16;
    const dim = entry.size >= 256 ? 0 : entry.size;
    out[pos] = dim;
    out[pos + 1] = dim;
    out[pos + 2] = 0;
    out[pos + 3] = 0;
    view.setUint16(pos + 4, 1, true); // color planes
    view.setUint16(pos + 6, 32, true); // bpp
    view.setUint32(pos + 8, entry.png.length, true);
    view.setUint32(pos + 12, offset, true);
    out.set(entry.png, offset);
    offset += entry.png.length;
  });
  return out;
}

/** Encode RGBA pixels into a standards compliant GIF89a image with LZW compression. */
export function encodeGif(rgba: Uint8ClampedArray, width: number, height: number, withAlpha = true): Uint8Array {
  // 6x7x6 uniform color cube (252 colors) + index 255 reserved for transparency.
  const palette = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 7; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx * 3] = Math.round((r * 255) / 5);
        palette[idx * 3 + 1] = Math.round((g * 255) / 6);
        palette[idx * 3 + 2] = Math.round((b * 255) / 5);
        idx++;
      }
    }
  }
  const transparentIndex = 255;
  let hasAlpha = false;
  const indices = new Uint8Array(width * height);
  for (let p = 0; p < indices.length; p++) {
    const a = rgba[p * 4 + 3];
    if (withAlpha && a < 128) {
      indices[p] = transparentIndex;
      hasAlpha = true;
    } else {
      const r = Math.round((rgba[p * 4] * 5) / 255);
      const g = Math.round((rgba[p * 4 + 1] * 6) / 255);
      const b = Math.round((rgba[p * 4 + 2] * 5) / 255);
      indices[p] = r * 42 + g * 6 + b;
    }
  }

  // Standard variable width LZW compressor (minCodeSize = 8)
  const minCodeSize = 8;
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const lzwBytes: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  const emitCode = (code: number, size: number) => {
    bitBuf |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      lzwBytes.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const dict = new Map<number, number>();
  const resetDict = () => {
    dict.clear();
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
  };

  emitCode(clearCode, codeSize);
  if (indices.length > 0) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const hit = dict.get(key);
      if (hit !== undefined) {
        prefix = hit;
      } else {
        emitCode(prefix, codeSize);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          emitCode(clearCode, codeSize);
          resetDict();
        }
        prefix = k;
      }
    }
    emitCode(prefix, codeSize);
  }
  emitCode(endCode, codeSize);
  if (bitCount > 0) lzwBytes.push(bitBuf & 0xff);

  const bytes: number[] = [];
  const pushAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  };
  const pushU16 = (v: number) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };

  pushAscii('GIF89a');
  pushU16(width);
  pushU16(height);
  bytes.push(0xf7, 0, 0); // GCT present, 8 bit, 256 entries
  for (let i = 0; i < palette.length; i++) bytes.push(palette[i]);

  if (hasAlpha) {
    bytes.push(0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, transparentIndex, 0x00);
  }

  bytes.push(0x2c); // Image Descriptor
  pushU16(0);
  pushU16(0);
  pushU16(width);
  pushU16(height);
  bytes.push(0x00);

  bytes.push(minCodeSize);
  for (let i = 0; i < lzwBytes.length; i += 255) {
    const chunk = lzwBytes.slice(i, i + 255);
    bytes.push(chunk.length, ...chunk);
  }
  bytes.push(0x00, 0x3b); // block terminator + trailer
  return new Uint8Array(bytes);
}


/* -------------------------------------------------------------------------- */
/* Raster decoders for the classic binary formats                             */
/* -------------------------------------------------------------------------- */

interface BmpOptions {
  icon?: boolean;
  heightOverride?: number;
}

export function decodeBmp(bytes: Uint8Array, options: BmpOptions = {}): Raster {
  const reader = new ByteReader(bytes);
  let dibStart = 0;
  let pixelOffset = 0;
  if (!options.icon) {
    if (reader.ascii(2) !== 'BM') throw new Error('Invalid BMP signature.');
    reader.u32le();
    reader.skip(4);
    pixelOffset = reader.u32le();
    dibStart = 14;
  }
  reader.seek(dibStart);
  const dibSize = reader.u32le();
  let width = 0;
  let height = 0;
  let bitsPerPixel = 0;
  let compression = 0;
  let topDown = false;
  let masks: number[] | null = null;
  if (dibSize >= 40) {
    width = reader.i32le();
    height = reader.i32le();
    reader.u16le();
    bitsPerPixel = reader.u16le();
    compression = reader.u32le();
    reader.u32le();
    reader.u32le();
    reader.u32le();
    reader.u32le();
    reader.u32le();
    if (height < 0) {
      topDown = true;
      height = -height;
    }
    if (dibSize >= 52 && compression === 3) {
      reader.seek(dibStart + 40);
      masks = [reader.u32le(), reader.u32le(), reader.u32le()];
      if (dibSize >= 56) masks.push(reader.u32le());
    } else if (dibSize >= 108 && bitsPerPixel === 32) {
      reader.seek(dibStart + 40);
      masks = [reader.u32le(), reader.u32le(), reader.u32le(), reader.u32le()];
    }
  } else if (dibSize === 12) {
    width = reader.u16le();
    height = reader.u16le();
    reader.u16le();
    bitsPerPixel = reader.u16le();
  } else {
    throw new Error('Unsupported BMP DIB header.');
  }
  if (options.icon && options.heightOverride) height = options.heightOverride;
  if (!width || !height) throw new Error('Invalid BMP dimensions.');
  const paletteCount = bitsPerPixel <= 8 ? (1 << bitsPerPixel) : 0;
  const palette: Array<[number, number, number]> = [];
  if (paletteCount) {
    reader.seek(dibStart + dibSize);
    for (let i = 0; i < paletteCount; i++) {
      const b = reader.u8();
      const g = reader.u8();
      const r = reader.u8();
      if (options.icon || dibSize < 40) reader.u8();
      palette.push([r, g, b]);
    }
  }
  const dataOffset = options.icon ? dibStart + dibSize + paletteCount * 4 : pixelOffset;
  const rowBytes = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const row = bytes.subarray(dataOffset + srcY * rowBytes, dataOffset + (srcY + 1) * rowBytes);
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      if (bitsPerPixel === 32) {
        data[dst] = row[x * 4 + 2];
        data[dst + 1] = row[x * 4 + 1];
        data[dst + 2] = row[x * 4];
        const alphaMask = masks?.[3] ?? 0;
        data[dst + 3] = alphaMask === 0 || alphaMask === 0xff000000 || options.icon ? row[x * 4 + 3] : 255;
      } else if (bitsPerPixel === 24) {
        data[dst] = row[x * 3 + 2];
        data[dst + 1] = row[x * 3 + 1];
        data[dst + 2] = row[x * 3];
        data[dst + 3] = 255;
      } else if (bitsPerPixel === 16) {
        const value = row[x * 2] | (row[x * 2 + 1] << 8);
        data[dst] = ((value >> 10) & 31) * 255 / 31;
        data[dst + 1] = ((value >> 5) & 31) * 255 / 31;
        data[dst + 2] = (value & 31) * 255 / 31;
        data[dst + 3] = 255;
      } else if (bitsPerPixel <= 8) {
        const bitIndex = x * bitsPerPixel;
        const byte = row[bitIndex >> 3];
        const shift = 8 - bitsPerPixel - (bitIndex & 7);
        const index = (byte >> shift) & ((1 << bitsPerPixel) - 1);
        const color = palette[index] ?? [0, 0, 0];
        data[dst] = color[0];
        data[dst + 1] = color[1];
        data[dst + 2] = color[2];
        data[dst + 3] = 255;
      } else {
        throw new Error(`Unsupported BMP bit depth ${bitsPerPixel}.`);
      }
    }
  }
  return { width, height, data };
}

interface TiffTag {
  type: number;
  count: number;
  values: number[];
}

function readTiffValues(reader: ByteReader, endian: 'le' | 'be', type: number, count: number): number[] {
  const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const size = (sizes[type] ?? 1) * count;
  const fieldStart = reader.pos;
  const offset = endian === 'le' ? reader.u32le() : reader.u32be();
  const saved = reader.pos;
  const start = size <= 4 ? fieldStart : offset;
  reader.seek(start);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    if (type === 1 || type === 2 || type === 6 || type === 7) values.push(reader.u8());
    else if (type === 3 || type === 8) values.push(endian === 'le' ? reader.u16le() : reader.u16be());
    else if (type === 4 || type === 9 || type === 11) values.push(endian === 'le' ? reader.u32le() : reader.u32be());
    else if (type === 5 || type === 10 || type === 12) {
      values.push(endian === 'le' ? reader.u32le() : reader.u32be());
      values.push(endian === 'le' ? reader.u32le() : reader.u32be());
    } else values.push(reader.u8());
  }
  reader.seek(saved);
  return values;
}

export function decodeTiff(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  const endianMark = reader.ascii(2);
  if (endianMark !== 'II' && endianMark !== 'MM') throw new Error('Invalid TIFF signature.');
  const endian = endianMark === 'II' ? 'le' : 'be';
  const u16 = () => (endian === 'le' ? reader.u16le() : reader.u16be());
  const u32 = () => (endian === 'le' ? reader.u32le() : reader.u32be());
  if (u16() !== 42) throw new Error('Invalid TIFF version.');
  const ifdOffset = u32();
  reader.seek(ifdOffset);
  const entries = u16();
  const tags = new Map<number, TiffTag>();
  for (let i = 0; i < entries; i++) {
    const tag = u16();
    const type = u16();
    const count = u32();
    const values = readTiffValues(reader, endian, type, count);
    tags.set(tag, { type, count, values });
  }
  const value = (tag: number, fallback: number) => tags.get(tag)?.values[0] ?? fallback;
  const width = value(256, 0);
  const height = value(257, 0);
  const compression = value(259, 1);
  const photometric = value(262, 2);
  const samples = value(277, 3);
  const planar = value(284, 1);
  const bits = tags.get(258)?.values ?? [8, 8, 8];
  const stripOffsets = tags.get(273)?.values ?? [];
  const stripCounts = tags.get(279)?.values ?? [];
  const rowsPerStrip = value(278, height);
  if (!width || !height || !stripOffsets.length) throw new Error('TIFF image data is missing.');
  if (compression !== 1 || planar !== 1) throw new Error('This TIFF needs the advanced UTIF decoder.');
  if (bits.some((bit) => bit !== 8 && bit !== 16)) throw new Error('Unsupported TIFF bit depth.');
  const strips: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < stripOffsets.length; i++) {
    const offset = stripOffsets[i];
    const count = stripCounts[i] ?? width * rowsPerStrip * samples * (bits[0] / 8);
    const strip = bytes.subarray(offset, Math.min(bytes.length, offset + count));
    strips.push(strip);
    total += strip.length;
  }
  const pixels = new Uint8Array(total);
  let cursor = 0;
  for (const strip of strips) {
    pixels.set(strip, cursor);
    cursor += strip.length;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const bytesPerSample = bits[0] === 16 ? 2 : 1;
  const pixelBytes = samples * bytesPerSample;
  const readSample = (offset: number) =>
    bytesPerSample === 2
      ? endian === 'le'
        ? pixels[offset] | (pixels[offset + 1] << 8)
        : (pixels[offset] << 8) | pixels[offset + 1]
      : pixels[offset];
  const scale = (sample: number) => (bytesPerSample === 2 ? Math.round(sample / 257) : sample);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * pixelBytes;
      const dst = (y * width + x) * 4;
      if (samples === 1) {
        let gray = scale(readSample(src));
        if (photometric === 0) gray = 255 - gray;
        data[dst] = gray;
        data[dst + 1] = gray;
        data[dst + 2] = gray;
        data[dst + 3] = 255;
      } else if (samples >= 3 && photometric === 2) {
        data[dst] = scale(readSample(src));
        data[dst + 1] = scale(readSample(src + bytesPerSample));
        data[dst + 2] = scale(readSample(src + bytesPerSample * 2));
        data[dst + 3] = samples >= 4 ? scale(readSample(src + bytesPerSample * 3)) : 255;
      } else if (samples >= 4 && photometric === 5) {
        const c = scale(readSample(src));
        const m = scale(readSample(src + bytesPerSample));
        const yy = scale(readSample(src + bytesPerSample * 2));
        const k = scale(readSample(src + bytesPerSample * 3));
        data[dst] = Math.round((255 - c) * (255 - k) / 255);
        data[dst + 1] = Math.round((255 - m) * (255 - k) / 255);
        data[dst + 2] = Math.round((255 - yy) * (255 - k) / 255);
        data[dst + 3] = 255;
      } else {
        throw new Error('Unsupported TIFF photometric interpretation.');
      }
    }
  }
  return { width, height, data };
}

function readGifSubBlocks(reader: ByteReader): Uint8Array<ArrayBuffer> {
  const parts: number[] = [];
  while (!reader.eof) {
    const size = reader.u8();
    if (!size) break;
    for (let i = 0; i < size; i++) parts.push(reader.u8());
  }
  return new Uint8Array(parts);
}

function lzwDecodeGif(bytes: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary: number[][] = Array.from({ length: clearCode }, (_, i) => [i]);
  let previous: number[] | null = null;
  const output: number[] = [];
  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = bytes[bitPos >> 3] ?? 0;
      code |= ((byte >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return code;
  };
  const reset = () => {
    dictionary = Array.from({ length: clearCode }, (_, i) => [i]);
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
    previous = null;
  };
  while (bitPos + codeSize <= bytes.length * 8) {
    const code = readCode();
    if (code === clearCode) {
      reset();
      continue;
    }
    if (code === endCode) break;
    let entry: number[];
    if (code < nextCode && dictionary[code]) entry = dictionary[code];
    else if (code === nextCode && previous) entry = previous.concat(previous[0]);
    else throw new Error('Invalid GIF LZW stream.');
    output.push(...entry);
    if (previous && nextCode < 4096) {
      dictionary[nextCode++] = previous.concat(entry[0]);
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize++;
    }
    previous = entry;
  }
  return new Uint8Array(output);
}

export function decodeGif(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  const signature = reader.ascii(6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('Invalid GIF signature.');
  const width = reader.u16le();
  const height = reader.u16le();
  const packed = reader.u8();
  reader.u8();
  reader.u8();
  const globalTable: number[] = [];
  if (packed & 0x80) {
    for (let i = 0; i < (2 << (packed & 7)) * 3; i++) globalTable.push(reader.u8());
  }
  let transparentIndex = -1;
  let localTable: number[] | null = null;
  let frameLeft = 0;
  let frameTop = 0;
  let frameWidth = 0;
  let frameHeight = 0;
  let interlaced = false;
  let lzwData = new Uint8Array();
  let minCodeSize = 8;
  while (!reader.eof) {
    const marker = reader.u8();
    if (marker === 0x21) {
      const label = reader.u8();
      if (label === 0xf9) {
        const size = reader.u8();
        const flags = reader.u8();
        reader.u16le();
        const transparent = reader.u8();
        reader.u8();
        if (flags & 1) transparentIndex = transparent;
        for (let i = 4; i < size; i++) reader.u8();
      } else {
        readGifSubBlocks(reader);
      }
    } else if (marker === 0x2c) {
      frameLeft = reader.u16le();
      frameTop = reader.u16le();
      frameWidth = reader.u16le();
      frameHeight = reader.u16le();
      const localPacked = reader.u8();
      interlaced = Boolean(localPacked & 0x40);
      if (localPacked & 0x80) {
        localTable = [];
        for (let i = 0; i < (2 << (localPacked & 7)) * 3; i++) localTable.push(reader.u8());
      }
      minCodeSize = reader.u8();
      lzwData = readGifSubBlocks(reader);
      break;
    } else if (marker === 0x3b) {
      break;
    } else {
      readGifSubBlocks(reader);
    }
  }
  if (!frameWidth || !frameHeight || !lzwData.length) throw new Error('GIF frame data is missing.');
  const indices = lzwDecodeGif(lzwData, minCodeSize);
  const table = localTable ?? globalTable;
  const data = new Uint8ClampedArray(width * height * 4);
  const rowOrder: number[] = [];
  if (interlaced) {
    for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
      for (let y = start; y < frameHeight; y += step) rowOrder.push(y);
    }
  } else {
    for (let y = 0; y < frameHeight; y++) rowOrder.push(y);
  }
  for (let row = 0; row < rowOrder.length; row++) {
    for (let x = 0; x < frameWidth; x++) {
      const index = indices[row * frameWidth + x];
      if (index === undefined || index === transparentIndex) continue;
      const dstY = frameTop + rowOrder[row];
      const dstX = frameLeft + x;
      if (dstX < 0 || dstY < 0 || dstX >= width || dstY >= height) continue;
      const dst = (dstY * width + dstX) * 4;
      data[dst] = table[index * 3] ?? 0;
      data[dst + 1] = table[index * 3 + 1] ?? 0;
      data[dst + 2] = table[index * 3 + 2] ?? 0;
      data[dst + 3] = 255;
    }
  }
  return { width, height, data };
}

export function encodeCur(entries: Array<{ size: number; png: Uint8Array; hotspotX?: number; hotspotY?: number }>): Uint8Array {
  const count = entries.length;
  const dirBytes = 6 + count * 16;
  const total = dirBytes + entries.reduce((sum, e) => sum + e.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 2, true);
  view.setUint16(4, count, true);
  let offset = dirBytes;
  entries.forEach((entry, idx) => {
    const pos = 6 + idx * 16;
    const dim = entry.size >= 256 ? 0 : entry.size;
    out[pos] = dim;
    out[pos + 1] = dim;
    out[pos + 2] = 0;
    out[pos + 3] = 0;
    view.setUint16(pos + 4, entry.hotspotX ?? 0, true);
    view.setUint16(pos + 6, entry.hotspotY ?? 0, true);
    view.setUint32(pos + 8, entry.png.length, true);
    view.setUint32(pos + 12, offset, true);
    out.set(entry.png, offset);
    offset += entry.png.length;
  });
  return out;
}

export function decodeIcon(bytes: Uint8Array, expectedType = 1): Raster {
  const reader = new ByteReader(bytes);
  reader.u16le();
  const type = reader.u16le();
  const count = reader.u16le();
  if (type !== expectedType || !count) throw new Error('Invalid icon container.');
  let best: { size: number; offset: number; sizeBytes: number } | null = null;
  for (let i = 0; i < count; i++) {
    const width = reader.u8() || 256;
    const height = reader.u8() || 256;
    reader.u8();
    reader.u8();
    reader.u16le();
    reader.u16le();
    const sizeBytes = reader.u32le();
    const offset = reader.u32le();
    if (!best || width * height > best.size) best = { size: width * height, offset, sizeBytes };
  }
  if (!best) throw new Error('No icon entries found.');
  const payload = bytes.subarray(best.offset, best.offset + best.sizeBytes);
  if (payload.subarray(0, 8).every((byte, index) => byte === PNG_SIGNATURE[index])) return decodePng(payload);
  const bmpReader = new ByteReader(payload);
  const dibSize = bmpReader.u32le();
  let height = 0;
  if (dibSize >= 40) {
    bmpReader.i32le();
    const rawHeight = bmpReader.i32le();
    height = Math.abs(rawHeight) / 2;
  }
  return decodeBmp(payload, { icon: true, heightOverride: Math.round(height) });
}

export function decodeCur(bytes: Uint8Array): Raster {
  return decodeIcon(bytes, 2);
}

export function encodeIcns(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const png = encodePng(rgba, width, height);
  const type = width >= 512 || height >= 512 ? 'ic10' : width >= 256 || height >= 256 ? 'ic09' : 'ic08';
  const writer = new ByteWriter();
  writer.ascii('icns').u32be(16 + png.length).ascii(type).u32be(8 + png.length).bytes(png);
  return writer.finish();
}

export function decodeIcns(bytes: Uint8Array): Raster {
  if (decodeText(bytes.subarray(0, 4)) !== 'icns') throw new Error('Invalid ICNS signature.');
  const reader = new ByteReader(bytes);
  reader.seek(8);
  while (reader.remaining >= 8) {
    const type = reader.ascii(4);
    const length = reader.u32be();
    const payload = reader.bytes(Math.max(0, length - 8));
    if (payload.subarray(0, 8).every((byte, index) => byte === PNG_SIGNATURE[index])) return decodePng(payload);
    if (type.startsWith('is32') || type.startsWith('il32') || type.startsWith('ih32')) {
      const side = type.startsWith('is32') ? 16 : type.startsWith('il32') ? 32 : 48;
      const data = new Uint8ClampedArray(side * side * 4);
      for (let p = 0; p < side * side; p++) {
        data[p * 4] = payload[4 + p] ?? 0;
        data[p * 4 + 1] = payload[4 + side * side + p] ?? 0;
        data[p * 4 + 2] = payload[4 + side * side * 2 + p] ?? 0;
        data[p * 4 + 3] = payload[4 + side * side * 3 + p] ?? 255;
      }
      return { width: side, height: side, data };
    }
  }
  throw new Error('ICNS has no supported image chunk.');
}

/* -------------------------------------------------------------------------- */
/* Quite OK Image Format                                                      */
/* -------------------------------------------------------------------------- */

function qoiHash(pixel: number): number {
  return (((pixel >>> 24) & 255) * 3 + ((pixel >>> 16) & 255) * 5 + ((pixel >>> 8) & 255) * 7 + (pixel & 255) * 11) % 64;
}

export function encodeQoi(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii('qoif').u32be(width).u32be(height).u8(4).u8(0);
  const index = new Uint32Array(64);
  const pixelAt = (p: number) =>
    ((rgba[p] << 24) | (rgba[p + 1] << 16) | (rgba[p + 2] << 8) | rgba[p + 3]) >>> 0;
  let previous = 0xff000000;
  let run = 0;
  const flushRun = () => {
    while (run > 0) {
      const chunk = Math.min(62, run);
      writer.u8(0xc0 | (chunk - 1));
      run -= chunk;
    }
  };
  for (let p = 0; p < rgba.length; p += 4) {
    const pixel = pixelAt(p);
    if (pixel === previous) {
      run++;
      if (run === 62) flushRun();
      continue;
    }
    flushRun();
    const slot = qoiHash(pixel);
    if (index[slot] === pixel) {
      writer.u8(slot);
    } else {
      index[slot] = pixel;
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      const a = rgba[p + 3];
      const prevA = previous & 255;
      if (a === prevA) {
        const dr = r - ((previous >>> 24) & 255);
        const dg = g - ((previous >>> 16) & 255);
        const db = b - ((previous >>> 8) & 255);
        if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
          writer.u8(0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2));
        } else {
          const drDg = dr - dg;
          const dbDg = db - dg;
          if (dg >= -32 && dg <= 31 && drDg >= -8 && drDg <= 7 && dbDg >= -8 && dbDg <= 7) {
            writer.u8(0x80 | (dg + 32)).u8(((drDg + 8) << 4) | (dbDg + 8));
          } else {
            writer.u8(0xfe).u8(r).u8(g).u8(b);
          }
        }
      } else {
        writer.u8(0xff).u8(r).u8(g).u8(b).u8(a);
      }
    }
    previous = pixel;
  }
  flushRun();
  writer.bytes([0, 0, 0, 0, 0, 0, 0, 1]);
  return writer.finish();
}

export function decodeQoi(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.ascii(4) !== 'qoif') throw new Error('Invalid QOI signature.');
  const width = reader.u32be();
  const height = reader.u32be();
  const channels = reader.u8();
  reader.u8();
  if (!width || !height || (channels !== 3 && channels !== 4)) throw new Error('Invalid QOI header.');
  const data = new Uint8ClampedArray(width * height * 4);
  const index = new Uint32Array(64);
  let pixel = 0xff000000;
  let run = 0;
  for (let p = 0; p < width * height; ) {
    if (run > 0) {
      run--;
    } else {
      const op = reader.u8();
      if (op === 0xff) {
        pixel = ((reader.u8() << 24) | (reader.u8() << 16) | (reader.u8() << 8) | reader.u8()) >>> 0;
      } else if (op === 0xfe) {
        pixel = (((reader.u8() << 24) | (reader.u8() << 16) | (reader.u8() << 8) | (pixel & 255)) >>> 0);
      } else if ((op & 0xc0) === 0x00) {
        pixel = index[op & 63];
      } else if ((op & 0xc0) === 0x40) {
        const dr = ((op >> 4) & 3) - 2;
        const dg = ((op >> 2) & 3) - 2;
        const db = (op & 3) - 2;
        const r = (((pixel >>> 24) & 255) + dr) & 255;
        const g = (((pixel >>> 16) & 255) + dg) & 255;
        const b = (((pixel >>> 8) & 255) + db) & 255;
        pixel = ((r << 24) | (g << 16) | (b << 8) | (pixel & 255)) >>> 0;
      } else if ((op & 0xc0) === 0x80) {
        const dg = (op & 63) - 32;
        const second = reader.u8();
        const drDg = (second >> 4) - 8;
        const dbDg = (second & 15) - 8;
        const r = (((pixel >>> 24) & 255) + dg + drDg) & 255;
        const g = (((pixel >>> 16) & 255) + dg) & 255;
        const b = (((pixel >>> 8) & 255) + dg + dbDg) & 255;
        pixel = ((r << 24) | (g << 16) | (b << 8) | (pixel & 255)) >>> 0;
      } else {
        run = (op & 63) + 1;
        p += 1;
        run -= 1;
        data[(p - 1) * 4] = (pixel >>> 24) & 255;
        data[(p - 1) * 4 + 1] = (pixel >>> 16) & 255;
        data[(p - 1) * 4 + 2] = (pixel >>> 8) & 255;
        data[(p - 1) * 4 + 3] = pixel & 255;
        continue;
      }
      index[qoiHash(pixel)] = pixel;
    }
    data[p * 4] = (pixel >>> 24) & 255;
    data[p * 4 + 1] = (pixel >>> 16) & 255;
    data[p * 4 + 2] = (pixel >>> 8) & 255;
    data[p * 4 + 3] = pixel & 255;
    p++;
  }
  return { width, height, data };
}

/* -------------------------------------------------------------------------- */
/* Container, text and ZIP based image formats                                */
/* -------------------------------------------------------------------------- */

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function findSequence(bytes: Uint8Array, sequence: Uint8Array | string, from = 0): number {
  const needle = typeof sequence === 'string' ? encodeText(sequence) : sequence;
  outer: for (let i = Math.max(0, from); i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export interface EmbeddedRaster {
  bytes: Uint8Array;
  kind: 'png' | 'jpeg';
}

export function findEmbeddedRaster(bytes: Uint8Array): EmbeddedRaster | null {
  let png = findSequence(bytes, PNG_SIGNATURE);
  while (png >= 0) {
    const iend = findSequence(bytes, 'IEND', png + 8);
    if (iend > png) {
      const candidate = bytes.subarray(png, Math.min(bytes.length, iend + 8));
      try {
        parsePngChunks(candidate);
        return { bytes: candidate, kind: 'png' };
      } catch {
        png = findSequence(bytes, PNG_SIGNATURE, png + 1);
      }
    } else {
      png = findSequence(bytes, PNG_SIGNATURE, png + 1);
    }
  }
  let jpeg = findSequence(bytes, new Uint8Array([0xff, 0xd8, 0xff]));
  while (jpeg >= 0) {
    let eoi = -1;
    for (let i = jpeg + 3; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        eoi = i + 2;
        break;
      }
    }
    if (eoi > jpeg) return { bytes: bytes.subarray(jpeg, eoi), kind: 'jpeg' };
    jpeg = findSequence(bytes, new Uint8Array([0xff, 0xd8, 0xff]), jpeg + 1);
  }
  return null;
}

export async function decodeEmbeddedRaster(bytes: Uint8Array): Promise<Raster> {
  const found = findEmbeddedRaster(bytes);
  if (!found) throw new Error('No embedded PNG or JPEG preview was found.');
  return found.kind === 'png' ? decodePng(found.bytes) : decodeJpeg(found.bytes);
}

export async function decodeWrappedRaster(bytes: Uint8Array): Promise<Raster> {
  const text = decodeText(bytes);
  const base64Match = /data:image\/png;base64,([A-Za-z0-9+/=]+)/i.exec(text);
  if (base64Match) return decodePng(base64ToBytes(base64Match[1]));
  const marker = 'MSAP_PNG_HEX:';
  const markerIndex = text.indexOf(marker);
  if (markerIndex >= 0) {
    const hex = text.slice(markerIndex + marker.length).replace(/[^0-9a-fA-F]/g, '');
    if (hex.length > 16) return decodePng(hexToBytes(hex));
  }
  return decodeEmbeddedRaster(bytes);
}

export function encodeSvg(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const dataUri = `data:image/png;base64,${bytesToBase64(encodePng(rgba, width, height))}`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <image href="${dataUri}" width="${width}" height="${height}"/>\n</svg>`;
  return encodeText(svg);
}

export function encodeSvgz(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  return pako.gzip(encodeSvg(rgba, width, height), { level: 9 });
}

export async function decodeSvgz(bytes: Uint8Array): Promise<Raster> {
  return decodeWrappedRaster(pako.ungzip(bytes));
}

export function encodeEps(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const png = encodePng(rgba, width, height);
  return encodeText(
    `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${width} ${height}\n%%HiResBoundingBox: 0 0 ${width} ${height}\n%%Creator: Micro Stocker Advanced Pro\n%%EndComments\n% MSAP_PNG_HEX:${bytesToHex(png)}\n%%EOF\n`,
  );
}

export interface PdfEncodeOptions {
  previewComment?: boolean;
  ai?: boolean;
}

export function encodePdf(rgba: Uint8ClampedArray, width: number, height: number, options: PdfEncodeOptions = {}): Uint8Array {
  const rgb = rasterToRgb({ width, height, data: new Uint8ClampedArray(rgba) });
  const stream = pako.deflate(rgb, { level: 6 });
  const content = encodeText(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`);
  const writer = new ByteWriter();
  const offsets = new Array<number>(7).fill(0);
  writer.ascii('%PDF-1.4\n%Micro Stocker Advanced Pro\n');
  const addObject = (number: number, body: Uint8Array | string) => {
    offsets[number] = writer.length;
    writer.ascii(`${number} 0 obj\n`).bytes(typeof body === 'string' ? encodeText(body) : body).ascii('\nendobj\n');
  };
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );
  addObject(
    4,
    concatBytes(encodeText(`<< /Length ${content.length} >>\nstream\n`), content, encodeText('endstream')),
  );
  addObject(
    5,
    concatBytes(
      encodeText(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${stream.length} >>\nstream\n`,
      ),
      stream,
      encodeText('\nendstream'),
    ),
  );
  const xref = writer.length;
  writer.ascii('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) writer.ascii(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  writer.ascii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  if (options.previewComment) {
    const png = encodePng(rgba, width, height);
    writer.ascii(`% MSAP_PNG_HEX:${bytesToHex(png)}\n`);
  }
  if (options.ai) {
    writer.ascii('%Adobe Illustrator compatible PDF container\n');
  }
  return writer.finish();
}

export function encodeAi(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  return encodePdf(rgba, width, height, { previewComment: true, ai: true });
}

export async function decodePdfPreview(bytes: Uint8Array): Promise<Raster> {
  try {
    return await decodeWrappedRaster(bytes);
  } catch {
    /* fall through to FlateDecode image extraction */
  }
  const imageObject = findSequence(bytes, '/Subtype /Image');
  if (imageObject < 0) throw new Error('PDF has no supported image object.');
  const streamToken = findSequence(bytes, 'stream', imageObject);
  if (streamToken < 0) throw new Error('PDF image stream is missing.');
  const endstream = findSequence(bytes, 'endstream', streamToken);
  if (endstream < 0) throw new Error('PDF image stream is truncated.');
  const dictionary = decodeText(bytes.subarray(Math.max(0, imageObject - 16), streamToken));
  const widthMatch = /\/Width\s+(\d+)/.exec(dictionary);
  const heightMatch = /\/Height\s+(\d+)/.exec(dictionary);
  if (!widthMatch || !heightMatch) throw new Error('PDF image dimensions are missing.');
  const width = Number(widthMatch[1]);
  const height = Number(heightMatch[1]);
  let start = streamToken + 6;
  if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) start += 2;
  else if (bytes[start] === 0x0a || bytes[start] === 0x0d) start += 1;
  let end = endstream;
  while (end > start && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)) end--;
  const raw = bytes.subarray(start, end);
  const rgb = dictionary.includes('/FlateDecode') ? pako.inflate(raw) : raw;
  if (rgb.length < width * height * 3) throw new Error('PDF image data is incomplete.');
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, i = 0; p < data.length; p += 4, i += 3) {
    data[p] = rgb[i];
    data[p + 1] = rgb[i + 1];
    data[p + 2] = rgb[i + 2];
    data[p + 3] = 255;
  }
  return { width, height, data };
}

export function decodeZipPreview(bytes: Uint8Array): Promise<Raster> {
  return (async () => {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('Invalid ZIP based design file.');
    const reader = new ByteReader(bytes);
    reader.seek(eocd + 10);
    const count = reader.u16le();
    reader.seek(eocd + 16);
    const centralOffset = reader.u32le();
    reader.seek(centralOffset);
    const entries: Array<{ name: string; method: number; compressedSize: number; localOffset: number }> = [];
    for (let i = 0; i < count && reader.remaining >= 46; i++) {
      const entryStart = reader.pos;
      if (reader.u32le() !== 0x02014b50) break;
      reader.seek(entryStart + 10);
      const method = reader.u16le();
      reader.seek(entryStart + 20);
      const compressedSize = reader.u32le();
      reader.seek(entryStart + 28);
      const nameLength = reader.u16le();
      const extraLength = reader.u16le();
      const commentLength = reader.u16le();
      reader.seek(entryStart + 42);
      const localOffset = reader.u32le();
      reader.seek(entryStart + 46);
      const name = reader.ascii(nameLength);
      reader.skip(extraLength + commentLength);
      entries.push({ name, method, compressedSize, localOffset });
    }
    const priority = ['mergedimage', 'preview', 'thumbnail', '.png', '.jpg', '.jpeg'];
    entries.sort((a, b) => {
      const score = (name: string) => {
        const lower = name.toLowerCase();
        const found = priority.findIndex((term) => lower.includes(term));
        return found < 0 ? 99 : found;
      };
      return score(a.name) - score(b.name);
    });
    for (const entry of entries) {
      if (entry.localOffset + 30 > bytes.length) continue;
      const local = new ByteReader(bytes);
      local.seek(entry.localOffset);
      if (local.u32le() !== 0x04034b50) continue;
      local.u16le();
      local.u16le();
      local.u16le();
      local.u16le();
      local.u16le();
      local.u32le();
      local.u32le();
      const nameLength = local.u16le();
      const extraLength = local.u16le();
      const dataStart = entry.localOffset + 30 + nameLength + extraLength;
      const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
      let payload = compressed;
      if (entry.method === 8) payload = pako.inflateRaw(compressed);
      else if (entry.method !== 0) continue;
      try {
        if (payload.subarray(0, 8).every((byte, index) => byte === PNG_SIGNATURE[index])) return decodePng(payload);
        if (payload[0] === 0xff && payload[1] === 0xd8) return decodeJpeg(payload);
        return decodeEmbeddedRaster(payload);
      } catch {
        /* try the next preview entry */
      }
    }
    throw new Error('No readable preview was found inside the design file.');
  })();
}

export async function decodeRawPreview(bytes: Uint8Array): Promise<Raster> {
  const tiffMagic = decodeText(bytes.subarray(0, 2));
  if (tiffMagic === 'II' || tiffMagic === 'MM') {
    try {
      return decodeTiff(bytes);
    } catch {
      return decodeTiffUtif(bytes);
    }
  }
  const found = findEmbeddedRaster(bytes);
  if (found) return found.kind === 'png' ? decodePng(found.bytes) : decodeJpeg(found.bytes);
  return decodeZipPreview(bytes);
}

export async function decodeTiffUtif(bytes: Uint8Array): Promise<Raster> {
  const scope = globalThis as typeof globalThis & { pako?: typeof pako };
  scope.pako = pako;
  const imported = (await import('utif2')) as unknown as {
    default?: UtifModule;
    decode?: UtifModule['decode'];
    decodeImage?: UtifModule['decodeImage'];
    toRGBA8?: UtifModule['toRGBA8'];
  };
  const UTIF = (imported.default ?? imported) as UtifModule;
  const buffer = sliceBytes(bytes).buffer as ArrayBuffer;
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error('TIFF contains no images.');
  const first = ifds.find((ifd) => ifd.t256 && ifd.t257) ?? ifds[0];
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  return rasterFromRgba(rgba, first.width, first.height);
}

interface UtifIfd {
  width: number;
  height: number;
  t256?: number[];
  t257?: number[];
  [key: string]: unknown;
}

interface UtifModule {
  decode: (buffer: ArrayBuffer) => UtifIfd[];
  decodeImage: (buffer: ArrayBuffer, ifd: UtifIfd) => void;
  toRGBA8: (ifd: UtifIfd) => Uint8Array;
}

/* -------------------------------------------------------------------------- */
/* HDR, floating point and VFX raster formats                                 */
/* -------------------------------------------------------------------------- */

const floatBits = new Float32Array(1);
const intBits = new Uint32Array(floatBits.buffer);

export function floatToHalf(value: number): number {
  floatBits[0] = value;
  const x = intBits[0];
  const sign = (x >>> 16) & 0x8000;
  let exponent = ((x >>> 23) & 0xff) - 127 + 15;
  let mantissa = x & 0x7fffff;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7c00;
  mantissa >>= 13;
  return sign | (exponent << 10) | mantissa;
}

export function halfToFloat(value: number): number {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const mantissa = value & 0x3ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 31) return mantissa ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

function exrAttribute(writer: ByteWriter, name: string, type: string, data: Uint8Array) {
  writer.ascii(name).u8(0).ascii(type).u8(0).u32le(data.length).bytes(data);
}

export function encodeExr(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u32le(0x01312f76).u32le(2);
  const channels = new ByteWriter();
  for (const name of ['B', 'G', 'R', 'A']) {
    channels.ascii(name).u8(0).i32le(1).u8(0).zeros(3).i32le(1).i32le(1);
  }
  channels.u8(0);
  exrAttribute(writer, 'channels', 'chlist', channels.finish());
  exrAttribute(writer, 'compression', 'compression', new Uint8Array([0]));
  const box = new ByteWriter();
  box.i32le(0).i32le(0).i32le(width - 1).i32le(height - 1);
  exrAttribute(writer, 'dataWindow', 'box2i', box.finish());
  exrAttribute(writer, 'displayWindow', 'box2i', box.finish());
  exrAttribute(writer, 'lineOrder', 'lineOrder', new Uint8Array([0]));
  const unit = new ByteWriter();
  unit.f32le(1);
  exrAttribute(writer, 'pixelAspectRatio', 'float', unit.finish());
  const center = new ByteWriter();
  center.f32le(0).f32le(0);
  exrAttribute(writer, 'screenWindowCenter', 'v2f', center.finish());
  exrAttribute(writer, 'screenWindowWidth', 'float', unit.finish());
  writer.u8(0);
  const offsetTableStart = writer.length;
  writer.zeros(height * 8);
  for (let y = 0; y < height; y++) {
    const chunkOffset = writer.length;
    writer.setU32le(offsetTableStart + y * 8, chunkOffset);
    writer.setU32le(offsetTableStart + y * 8 + 4, 0);
    const data = new ByteWriter();
    for (const component of [2, 1, 0, 3]) {
      for (let x = 0; x < width; x++) {
        const value = rgba[(y * width + x) * 4 + component] / 255;
        data.u16le(floatToHalf(value));
      }
    }
    const scanline = data.finish();
    writer.i32le(y).i32le(scanline.length).bytes(scanline);
  }
  return writer.finish();
}

interface ExrChannel {
  name: string;
  pixelType: number;
  xSampling: number;
  ySampling: number;
}

export function decodeExr(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.u32le() !== 0x01312f76) throw new Error('Invalid OpenEXR signature.');
  reader.u32le();
  const attributes = new Map<string, { type: string; data: Uint8Array }>();
  while (!reader.eof) {
    const name = reader.cstring();
    if (!name) break;
    const type = reader.cstring();
    const size = reader.u32le();
    attributes.set(name, { type, data: new Uint8Array(reader.bytes(size)) });
  }
  const channelsAttr = attributes.get('channels');
  const windowAttr = attributes.get('dataWindow');
  const compression = attributes.get('compression')?.data[0] ?? 0;
  if (!channelsAttr || !windowAttr) throw new Error('OpenEXR header is incomplete.');
  if (compression !== 0) throw new Error('Only uncompressed scanline OpenEXR files are supported natively.');
  const channelReader = new ByteReader(channelsAttr.data);
  const channels: ExrChannel[] = [];
  while (!channelReader.eof) {
    const name = channelReader.cstring();
    if (!name) break;
    channels.push({
      name,
      pixelType: channelReader.i32le(),
      xSampling: (channelReader.u8(), channelReader.skip(3), channelReader.i32le()),
      ySampling: channelReader.i32le(),
    });
  }
  const box = new ByteReader(windowAttr.data);
  const xMin = box.i32le();
  const yMin = box.i32le();
  const xMax = box.i32le();
  const yMax = box.i32le();
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  if (!width || !height) throw new Error('Invalid OpenEXR dimensions.');
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) data[p * 4 + 3] = 255;
  const offsets = new Array<number>(height);
  for (let i = 0; i < height; i++) offsets[i] = reader.u64le();
  for (let chunk = 0; chunk < height; chunk++) {
    const offset = offsets[chunk];
    if (!Number.isFinite(offset) || offset <= 0 || offset >= bytes.length) continue;
    const chunkReader = new ByteReader(bytes);
    chunkReader.seek(offset);
    const y = chunkReader.i32le() - yMin;
    const dataSize = chunkReader.i32le();
    const pixelData = chunkReader.bytes(dataSize);
    const planeReader = new ByteReader(pixelData);
    for (const channel of channels) {
      if (channel.xSampling !== 1 || channel.ySampling !== 1) continue;
      const component = channel.name === 'R' ? 0 : channel.name === 'G' ? 1 : channel.name === 'B' ? 2 : channel.name === 'A' ? 3 : -1;
      for (let x = 0; x < width; x++) {
        let value = 0;
        if (channel.pixelType === 1) value = halfToFloat(planeReader.u16le()) * 255;
        else if (channel.pixelType === 2) value = planeReader.f32le() * 255;
        else if (channel.pixelType === 0) value = planeReader.u32le();
        else throw new Error('Unsupported OpenEXR channel type.');
        if (component >= 0 && y >= 0 && y < height) {
          data[(y * width + x) * 4 + component] = Math.max(0, Math.min(255, value));
        }
      }
    }
  }
  return { width, height, data };
}

function rgbaToRgbe(r: number, g: number, b: number): [number, number, number, number] {
  const max = Math.max(r, g, b);
  if (max < 1) return [0, 0, 0, 128];
  const exponent = 128;
  return [r, g, b, exponent];
}

function rgbeToRgba(r: number, g: number, b: number, e: number): [number, number, number, number] {
  if (e === 128) return [r, g, b, 255];
  const scale = 2 ** Math.max(-20, Math.min(20, e - 128));
  return [
    Math.max(0, Math.min(255, Math.round(r * scale))),
    Math.max(0, Math.min(255, Math.round(g * scale))),
    Math.max(0, Math.min(255, Math.round(b * scale))),
    255,
  ];
}

function encodeRgbeScanline(row: Uint8Array, width: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u8(2).u8(2).u8((width >> 8) & 0xff).u8(width & 0xff);
  const literalRun = (start: number, count: number, channel: number) => {
    writer.u8(128 + count);
    for (let i = 0; i < count; i++) writer.u8(row[(start + i) * 4 + channel]);
  };
  for (let channel = 0; channel < 4; channel++) {
    let x = 0;
    while (x < width) {
      let run = 1;
      while (x + run < width && row[(x + run) * 4 + channel] === row[x * 4 + channel] && run < 127) run++;
      if (run >= 4) {
        writer.u8(128 + run).u8(row[x * 4 + channel]);
        x += run;
      } else {
        const start = x;
        x++;
        while (x < width && x - start < 128) {
          let repeat = 1;
          while (x + repeat < width && row[(x + repeat) * 4 + channel] === row[x * 4 + channel]) repeat++;
          if (repeat >= 4) break;
          x++;
        }
        literalRun(start, Math.max(1, x - start), channel);
      }
    }
  }
  return writer.finish();
}

export function encodeHdr(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n');
  writer.ascii(`-Y ${height} +X ${width}\n`);
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(width * 4);
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const [r, g, b, e] = rgbaToRgbe(rgba[p], rgba[p + 1], rgba[p + 2]);
      row.set([r, g, b, e], x * 4);
    }
    if (width < 8 || width >= 32768) {
      for (const byte of row) writer.u8(byte);
    } else {
      writer.bytes(encodeRgbeScanline(row, width));
    }
  }
  return writer.finish();
}

function decodeRgbeScanline(reader: ByteReader, width: number): Uint8Array {
  const out = new Uint8Array(width * 4);
  const first = [reader.u8(), reader.u8(), reader.u8(), reader.u8()];
  if (first[0] !== 2 || first[1] !== 2 || (first[2] << 8 | first[3]) !== width) {
    out.set(first);
    for (let i = 4; i < out.length; i++) out[i] = reader.u8();
    return out;
  }
  for (let channel = 0; channel < 4; channel++) {
    let x = 0;
    while (x < width) {
      const code = reader.u8();
      if (code > 128) {
        const count = code - 128;
        if (count === 0 || count > width - x) throw new Error('Invalid Radiance RLE run.');
        const value = reader.u8();
        for (let i = 0; i < count; i++) out[(x + i) * 4 + channel] = value;
        x += count;
      } else {
        const count = code;
        if (!count || count > width - x) throw new Error('Invalid Radiance RLE literal.');
        for (let i = 0; i < count; i++) out[(x + i) * 4 + channel] = reader.u8();
        x += count;
      }
    }
  }
  return out;
}

export function decodeHdr(bytes: Uint8Array): Raster {
  const text = decodeText(bytes);
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i]) i++;
  const resolution = lines[i + 1] ?? '';
  const match = /-Y\s+(\d+)\s+\+X\s+(\d+)/.exec(resolution);
  if (!match) throw new Error('Invalid Radiance HDR header.');
  const height = Number(match[1]);
  const width = Number(match[2]);
  let byteOffset = 0;
  for (let line = 0; line <= i + 1; line++) byteOffset += (lines[line]?.length ?? 0) + 1;
  const reader = new ByteReader(bytes);
  reader.seek(byteOffset);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = decodeRgbeScanline(reader, width);
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = rgbeToRgba(row[x * 4], row[x * 4 + 1], row[x * 4 + 2], row[x * 4 + 3]);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function encodePfm(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii(`PF\n${width} ${height}\n-1.0\n`);
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      writer.f32le(rgba[p] / 255).f32le(rgba[p + 1] / 255).f32le(rgba[p + 2] / 255);
    }
  }
  return writer.finish();
}

export function decodePfm(bytes: Uint8Array): Raster {
  const headerEnd = findSequence(bytes, '\n', findSequence(bytes, '\n', findSequence(bytes, '\n') + 1) + 1);
  if (headerEnd < 0) throw new Error('Invalid PFM header.');
  const header = decodeText(bytes.subarray(0, headerEnd));
  const lines = header.split(/\r?\n/).filter(Boolean);
  const magic = lines[0]?.trim();
  const dims = lines[1]?.trim().split(/\s+/).map(Number) ?? [];
  const scale = Number(lines[2]?.trim() ?? '1');
  if (!magic?.startsWith('P') || dims.length < 2) throw new Error('Invalid PFM dimensions.');
  const width = dims[0];
  const height = dims[1];
  const channels = magic === 'PF' ? 3 : 1;
  const littleEndian = scale < 0;
  const reader = new ByteReader(bytes);
  reader.seek(headerEnd + 1);
  const data = new Uint8ClampedArray(width * height * 4);
  const floats = new Float32Array(width * height * channels);
  for (let i = 0; i < floats.length; i++) floats[i] = littleEndian ? reader.f32le() : reader.f32be();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceY = height - 1 - y;
      const src = (sourceY * width + x) * channels;
      const dst = (y * width + x) * 4;
      const r = Math.max(0, Math.min(255, Math.round(Math.abs(scale) * floats[src] * 255)));
      const g = channels === 3 ? Math.max(0, Math.min(255, Math.round(Math.abs(scale) * floats[src + 1] * 255))) : r;
      const b = channels === 3 ? Math.max(0, Math.min(255, Math.round(Math.abs(scale) * floats[src + 2] * 255))) : r;
      data[dst] = r;
      data[dst + 1] = g;
      data[dst + 2] = b;
      data[dst + 3] = 255;
    }
  }
  return { width, height, data };
}

/* -------------------------------------------------------------------------- */
/* Desktop, texture, cinema and workstation raster formats                    */
/* -------------------------------------------------------------------------- */

export function encodeTga(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u8(0).u8(0).u8(2).zeros(5);
  writer.u16le(0).u16le(0).u16le(width).u16le(height).u8(32).u8(0x28);
  const row = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      row[x * 4] = rgba[src + 2];
      row[x * 4 + 1] = rgba[src + 1];
      row[x * 4 + 2] = rgba[src];
      row[x * 4 + 3] = rgba[src + 3];
    }
    writer.bytes(row);
  }
  return writer.finish();
}

export function decodeTga(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  const idLength = reader.u8();
  const colorMapType = reader.u8();
  const imageType = reader.u8();
  reader.skip(5);
  reader.u16le();
  reader.u16le();
  const width = reader.u16le();
  const height = reader.u16le();
  const depth = reader.u8();
  const descriptor = reader.u8();
  if (colorMapType !== 0 || ![2, 3, 10, 11].includes(imageType)) throw new Error('Unsupported TGA variant.');
  if (depth !== 24 && depth !== 32 && !(imageType >= 9 && depth === 8)) throw new Error('Unsupported TGA pixel depth.');
  reader.skip(idLength);
  const pixelBytes = Math.max(1, depth / 8);
  const pixels = new Uint8Array(width * height * pixelBytes);
  if (imageType === 2 || imageType === 3) {
    for (let i = 0; i < pixels.length; i++) pixels[i] = reader.u8();
  } else {
    let p = 0;
    while (p < pixels.length) {
      const packet = reader.u8();
      const count = (packet & 0x7f) + 1;
      if (packet & 0x80) {
        const value: number[] = [];
        for (let i = 0; i < pixelBytes; i++) value.push(reader.u8());
        for (let i = 0; i < count && p < pixels.length; i++) {
          for (const byte of value) pixels[p++] = byte;
        }
      } else {
        for (let i = 0; i < count * pixelBytes && p < pixels.length; i++) pixels[p++] = reader.u8();
      }
    }
  }
  const topDown = Boolean(descriptor & 0x20);
  const rightToLeft = Boolean(descriptor & 0x10);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const sourceRow = topDown ? row : height - 1 - row;
    for (let x = 0; x < width; x++) {
      const sourceX = rightToLeft ? width - 1 - x : x;
      const src = (sourceRow * width + sourceX) * pixelBytes;
      const dst = (row * width + x) * 4;
      if (pixelBytes >= 3) {
        data[dst] = pixels[src + 2];
        data[dst + 1] = pixels[src + 1];
        data[dst + 2] = pixels[src];
        data[dst + 3] = pixelBytes === 4 ? pixels[src + 3] : 255;
      } else {
        const gray = pixels[src];
        data[dst] = gray;
        data[dst + 1] = gray;
        data[dst + 2] = gray;
        data[dst + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

export function encodeDds(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii('DDS ').u32le(124);
  writer.u32le(0x100f).u32le(height).u32le(width).u32le(width * 4).u32le(0).u32le(0);
  writer.zeros(44);
  writer.u32le(32).u32le(0x41).u32le(0).u32le(32);
  writer.u32le(0x00ff0000).u32le(0x0000ff00).u32le(0x000000ff).u32le(0xff000000);
  writer.u32le(0x1000);
  writer.zeros(16);
  for (let p = 0; p < rgba.length; p += 4) {
    writer.u8(rgba[p + 2]).u8(rgba[p + 1]).u8(rgba[p]).u8(rgba[p + 3]);
  }
  return writer.finish();
}

function rgb565ToRgba(color: number): [number, number, number] {
  const r = (color >> 11) & 31;
  const g = (color >> 5) & 63;
  const b = color & 31;
  return [Math.round(r * 255 / 31), Math.round(g * 255 / 63), Math.round(b * 255 / 31)];
}

function decodeDxt1(data: Uint8Array, width: number, height: number): Raster {
  const out = new Uint8ClampedArray(width * height * 4);
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  const reader = new ByteReader(data);
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const c0 = reader.u16le();
      const c1 = reader.u16le();
      const indices = reader.u32le();
      const color0 = rgb565ToRgba(c0);
      const color1 = rgb565ToRgba(c1);
      const palette: Array<[number, number, number, number]> = [
        [...color0, 255],
        [...color1, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 0],
      ];
      if (c0 > c1) {
        palette[2] = [
          Math.round((color0[0] * 2 + color1[0]) / 3),
          Math.round((color0[1] * 2 + color1[1]) / 3),
          Math.round((color0[2] * 2 + color1[2]) / 3),
          255,
        ];
        palette[3] = [
          Math.round((color0[0] + color1[0] * 2) / 3),
          Math.round((color0[1] + color1[1] * 2) / 3),
          Math.round((color0[2] + color1[2] * 2) / 3),
          255,
        ];
      } else {
        palette[2] = [
          Math.round((color0[0] + color1[0]) / 2),
          Math.round((color0[1] + color1[1]) / 2),
          Math.round((color0[2] + color1[2]) / 2),
          255,
        ];
      }
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const dstX = bx * 4 + x;
          const dstY = by * 4 + y;
          if (dstX >= width || dstY >= height) continue;
          const index = (indices >> ((y * 4 + x) * 2)) & 3;
          out.set(palette[index], (dstY * width + dstX) * 4);
        }
      }
    }
  }
  return { width, height, data: out };
}

export function decodeDds(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.ascii(4) !== 'DDS ') throw new Error('Invalid DDS signature.');
  reader.u32le();
  reader.u32le();
  const height = reader.u32le();
  const width = reader.u32le();
  reader.seek(84);
  const fourCC = reader.ascii(4);
  const bitCount = reader.u32le();
  if (fourCC === 'DXT1') return decodeDxt1(bytes.subarray(128), width, height);
  if (bitCount !== 24 && bitCount !== 32) throw new Error('Unsupported DDS pixel format.');
  reader.seek(128);
  const data = new Uint8ClampedArray(width * height * 4);
  const pixelBytes = bitCount / 8;
  for (let p = 0; p < width * height; p++) {
    const pixel: number[] = [];
    for (let i = 0; i < pixelBytes; i++) pixel.push(reader.u8());
    data[p * 4] = pixel[2] ?? pixel[0];
    data[p * 4 + 1] = pixel[1] ?? pixel[0];
    data[p * 4 + 2] = pixel[0] ?? 0;
    data[p * 4 + 3] = pixelBytes === 4 ? pixel[3] : 255;
  }
  return { width, height, data };
}

const KTX_IDENTIFIER = new Uint8Array([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);

export function encodeKtx(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.bytes(KTX_IDENTIFIER);
  writer.u32le(0x04030201).u32le(0).u32le(1).u32le(0).u32le(0x8058).u32le(0x1908);
  writer.u32le(width).u32le(height).u32le(0).u32le(0).u32le(1).u32le(1).u32le(0);
  writer.u32le(width * height * 4).bytes(rgba);
  return writer.finish();
}

export function decodeKtx(bytes: Uint8Array): Raster {
  if (!bytes.subarray(0, 12).every((byte, index) => byte === KTX_IDENTIFIER[index])) {
    throw new Error('Invalid KTX identifier.');
  }
  const reader = new ByteReader(bytes);
  reader.seek(12);
  const endian = reader.u32le();
  const little = endian === 0x04030201;
  const u32 = () => (little ? reader.u32le() : reader.u32be());
  const glType = u32();
  reader.u32le();
  const glFormat = u32();
  reader.u32le();
  reader.u32le();
  const width = u32();
  const height = u32();
  u32();
  u32();
  u32();
  const mipLevels = u32();
  const keyValueBytes = u32();
  reader.skip(keyValueBytes);
  if (glType !== 0 || glFormat !== 0) throw new Error('Unsupported compressed KTX texture.');
  if (mipLevels > 1) reader.u32le();
  const imageSize = u32();
  const payload = new Uint8Array(reader.bytes(Math.min(imageSize, width * height * 4)));
  return { width, height, data: new Uint8ClampedArray(payload) };
}

export function encodeDpx(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = new Uint8Array(2048);
  const view = new DataView(header.buffer);
  header.set(encodeText('SDPX'), 0);
  view.setUint32(4, 2048, false);
  header.set(encodeText('V2.0\0\0\0\0'), 8);
  view.setUint32(16, 2048 + width * height * 4, false);
  view.setUint32(20, 1, false);
  view.setUint32(24, 1664, false);
  view.setUint32(28, 384, false);
  view.setUint32(36, 0xffffffff, false);
  view.setUint16(768, 0, false);
  view.setUint16(770, 1, false);
  view.setUint32(772, width, false);
  view.setUint32(776, height, false);
  view.setUint8(780, 50);
  view.setUint8(781, 8);
  view.setUint16(782, 0, false);
  const writer = new ByteWriter();
  writer.bytes(header);
  for (let p = 0; p < rgba.length; p += 4) {
    writer.u8(rgba[p]).u8(rgba[p + 1]).u8(rgba[p + 2]).u8(rgba[p + 3]);
  }
  return writer.finish();
}

export function decodeDpx(bytes: Uint8Array): Raster {
  const magic = decodeText(bytes.subarray(0, 4));
  const little = magic === 'XPDS';
  if (magic !== 'SDPX' && !little) throw new Error('Invalid DPX signature.');
  const reader = new ByteReader(bytes);
  reader.seek(4);
  const dataOffset = little ? reader.u32le() : reader.u32be();
  reader.seek(772);
  const width = little ? reader.u32le() : reader.u32be();
  const height = little ? reader.u32le() : reader.u32be();
  const offset = dataOffset || 2048;
  const data = new Uint8ClampedArray(width * height * 4);
  const source = bytes.subarray(offset, offset + width * height * 4);
  data.set(source.subarray(0, Math.min(source.length, data.length)));
  return { width, height, data };
}

export function encodeCin(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = new Uint8Array(2048);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x802a5fd7, false);
  view.setUint32(4, 2048, false);
  view.setUint32(8, 2048 + width * height * 4, false);
  view.setUint32(12, 1, false);
  view.setUint32(16, 1024, false);
  view.setUint32(20, width, false);
  view.setUint32(24, height, false);
  view.setUint32(28, 3, false);
  view.setUint32(32, 10, false);
  header.set(encodeText('V4.5'), 36);
  const writer = new ByteWriter();
  writer.bytes(header);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const value = [0, 1, 2].map((channel) => Math.round(rgba[p + channel] * 1023 / 255));
      writer.u32be(((value[0] << 22) | (value[1] << 12) | (value[2] << 2)) >>> 0);
    }
  }
  return writer.finish();
}

export function decodeCin(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.u32be() !== 0x802a5fd7) throw new Error('Invalid Cineon signature.');
  const dataOffset = reader.u32be();
  reader.seek(20);
  const width = reader.u32be();
  const height = reader.u32be();
  reader.seek(dataOffset || 2048);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const packed = reader.u32be();
    const samples = [(packed >>> 22) & 1023, (packed >>> 12) & 1023, (packed >>> 2) & 1023];
    for (let channel = 0; channel < 3; channel++) data[p * 4 + channel] = Math.round(samples[channel] * 255 / 1023);
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}

function sgiRleRow(row: Uint8Array): Uint8Array {
  const writer = new ByteWriter();
  let p = 0;
  while (p < row.length) {
    let repeat = 1;
    while (p + repeat < row.length && row[p + repeat] === row[p] && repeat < 126) repeat++;
    if (repeat >= 3) {
      writer.u8(0x80 | repeat).u8(row[p]);
      p += repeat;
    } else {
      const start = p;
      p++;
      while (p < row.length && p - start < 127) {
        let nextRepeat = 1;
        while (p + nextRepeat < row.length && row[p + nextRepeat] === row[p] && nextRepeat < 3) nextRepeat++;
        if (nextRepeat >= 3) break;
        p++;
      }
      writer.u8(p - start);
      writer.bytes(row.subarray(start, p));
    }
  }
  writer.u8(0);
  return writer.finish();
}

function decodeSgiRleRow(reader: ByteReader, length: number, row: Uint8Array) {
  const end = reader.pos + length;
  let p = 0;
  while (reader.pos < end && p < row.length) {
    const code = reader.u8();
    if (!code) break;
    if (code & 0x80) {
      const count = code & 0x7f;
      const value = reader.u8();
      for (let i = 0; i < count && p < row.length; i++) row[p++] = value;
    } else {
      for (let i = 0; i < code && p < row.length; i++) row[p++] = reader.u8();
    }
  }
  reader.seek(end);
}

export function encodeSgi(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16be(474).u8(0).u8(1).u16be(3).u16be(width).u16be(height).u16be(4);
  writer.u32be(0).u32be(255).u32be(0);
  writer.zeros(80 + 4 + 404);
  for (let y = height - 1; y >= 0; y--) {
    for (let channel = 0; channel < 4; channel++) {
      const row = new Uint8Array(width);
      for (let x = 0; x < width; x++) row[x] = rgba[(y * width + x) * 4 + channel];
      writer.bytes(row);
    }
  }
  return writer.finish();
}

export function decodeSgi(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.u16be() !== 474) throw new Error('Invalid SGI signature.');
  const storage = reader.u8();
  const bpc = reader.u8();
  const dimension = reader.u16be();
  const width = reader.u16be();
  const height = reader.u16be();
  const channels = reader.u16be();
  if (bpc !== 1 || dimension !== 3 || channels < 1 || channels > 4) throw new Error('Unsupported SGI layout.');
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) data[p * 4 + 3] = 255;
  if (storage === 0) {
    reader.seek(512);
    for (let row = 0; row < height; row++) {
      const y = height - 1 - row;
      for (let channel = 0; channel < channels; channel++) {
        const rowData = reader.bytes(width);
        for (let x = 0; x < width; x++) data[(y * width + x) * 4 + channel] = rowData[x];
      }
    }
  } else if (storage === 1) {
    const tableLength = height * channels;
    const offsets = new Array<number>(tableLength);
    const lengths = new Array<number>(tableLength);
    for (let i = 0; i < tableLength; i++) offsets[i] = reader.u32be();
    for (let i = 0; i < tableLength; i++) lengths[i] = reader.u32be();
    for (let i = 0; i < tableLength; i++) {
      const row = new Uint8Array(width);
      reader.seek(offsets[i]);
      decodeSgiRleRow(reader, lengths[i], row);
      const channel = i % channels;
      const rowIndex = Math.floor(i / channels);
      const y = height - 1 - rowIndex;
      for (let x = 0; x < width; x++) data[(y * width + x) * 4 + channel] = row[x];
    }
  } else {
    throw new Error('Unsupported SGI storage mode.');
  }
  return { width, height, data };
}

/* -------------------------------------------------------------------------- */
/* Palette, classic and scientific formats                                    */
/* -------------------------------------------------------------------------- */

export interface QuantizedRaster {
  palette: Array<[number, number, number, number]>;
  indices: Uint16Array;
}

export function quantizeRgba(rgba: Uint8ClampedArray, maxColors = 256): QuantizedRaster {
  const counts = new Map<number, number>();
  const transparentKey = -1;
  for (let p = 0; p < rgba.length; p += 4) {
    const key = rgba[p + 3] < 64
      ? transparentKey
      : ((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .filter(([key]) => key !== transparentKey)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, maxColors - 1));
  const palette: Array<[number, number, number, number]> = sorted.map(([key]) => {
    const r5 = (key >> 10) & 31;
    const g5 = (key >> 5) & 31;
    const b5 = key & 31;
    return [Math.round(r5 * 255 / 31), Math.round(g5 * 255 / 31), Math.round(b5 * 255 / 31), 255];
  });
  if (!palette.length) palette.push([0, 0, 0, 255]);
  if (counts.has(transparentKey)) palette.push([0, 0, 0, 0]);
  const indices = new Uint16Array(rgba.length / 4);
  for (let p = 0, i = 0; p < rgba.length; p += 4, i++) {
    const alpha = rgba[p + 3];
    if (alpha < 64 && counts.has(transparentKey)) {
      indices[i] = palette.length - 1;
      continue;
    }
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let c = 0; c < palette.length; c++) {
      const color = palette[c];
      if (color[3] === 0) continue;
      const dr = rgba[p] - color[0];
      const dg = rgba[p + 1] - color[1];
      const db = rgba[p + 2] - color[2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = c;
      }
    }
    indices[i] = best;
  }
  return { palette, indices };
}

function iffChunk(id: string, data: Uint8Array): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii(id).u32be(data.length).bytes(data);
  if (data.length & 1) writer.u8(0);
  return writer.finish();
}

function decodeByteRun1(bytes: Uint8Array, expectedLength: number): Uint8Array {
  const reader = new ByteReader(bytes);
  const out = new Uint8Array(expectedLength);
  let p = 0;
  while (!reader.eof && p < out.length) {
    const code = reader.u8();
    if (code <= 127) {
      const count = code + 1;
      for (let i = 0; i < count && p < out.length; i++) out[p++] = reader.u8();
    } else if (code !== 128) {
      const count = 257 - code;
      const value = reader.u8();
      for (let i = 0; i < count && p < out.length; i++) out[p++] = value;
    }
  }
  return out;
}

export function encodeIff(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const { palette, indices } = quantizeRgba(rgba, 256);
  const bmhd = new ByteWriter();
  bmhd.u16be(width).u16be(height).u16be(0).u16be(0).u8(8).u8(0).u8(0).u8(0);
  bmhd.u16be(1).u16be(1).u16be(width).u16be(height);
  const cmap = new Uint8Array(256 * 3);
  palette.forEach((color, index) => {
    cmap[index * 3] = color[0];
    cmap[index * 3 + 1] = color[1];
    cmap[index * 3 + 2] = color[2];
  });
  const rowBytes = Math.ceil(width / 8) + (Math.ceil(width / 8) & 1);
  const body = new Uint8Array(rowBytes * 8 * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    for (let plane = 0; plane < 8; plane++) {
      for (let byte = 0; byte < rowBytes; byte++) {
        let value = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byte * 8 + bit;
          if (x < width && (indices[y * width + x] & (1 << plane))) value |= 0x80 >> bit;
        }
        body[offset++] = value;
      }
    }
  }
  const parts = [iffChunk('BMHD', bmhd.finish()), iffChunk('CMAP', cmap), iffChunk('BODY', body)];
  const bodyLength = 4 + parts.reduce((sum, part) => sum + part.length, 0);
  const writer = new ByteWriter();
  writer.ascii('FORM').u32be(bodyLength).ascii('ILBM').bytes(concatBytes(...parts));
  return writer.finish();
}

export function decodeIff(bytes: Uint8Array): Raster {
  if (decodeText(bytes.subarray(0, 4)) !== 'FORM') throw new Error('Invalid IFF FORM container.');
  const type = decodeText(bytes.subarray(8, 12));
  if (type !== 'ILBM' && type !== 'PBM ') throw new Error('Unsupported IFF image type.');
  let width = 0;
  let height = 0;
  let planes = 0;
  let compression = 0;
  let palette: Array<[number, number, number]> = [];
  let rawBody = new Uint8Array();
  const reader = new ByteReader(bytes);
  reader.seek(12);
  while (reader.remaining >= 8) {
    const id = reader.ascii(4);
    const length = reader.u32be();
    const data = new Uint8Array(reader.bytes(length));
    if (length & 1) reader.u8();
    if (id === 'BMHD') {
      const header = new ByteReader(data);
      width = header.u16be();
      height = header.u16be();
      header.u16be();
      header.u16be();
      planes = header.u8();
      header.u8();
      compression = header.u8();
    } else if (id === 'CMAP') {
      palette = [];
      for (let p = 0; p + 2 < data.length; p += 3) palette.push([data[p], data[p + 1], data[p + 2]]);
    } else if (id === 'BODY') {
      rawBody = data;
      break;
    }
  }
  if (!width || !height || !planes || !rawBody.length) throw new Error('IFF image data is incomplete.');
  const rowBytes = Math.ceil(width / 8) + (Math.ceil(width / 8) & 1);
  const expected = rowBytes * planes * height;
  const body = compression === 1 ? decodeByteRun1(rawBody, expected) : rawBody;
  const data = new Uint8ClampedArray(width * height * 4);
  const indices = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let plane = 0; plane < planes; plane++) {
      for (let byte = 0; byte < rowBytes; byte++) {
        const value = body[((y * planes + plane) * rowBytes) + byte] ?? 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byte * 8 + bit;
          if (x < width && (value & (0x80 >> bit))) indices[y * width + x] |= 1 << plane;
        }
      }
    }
  }
  for (let p = 0; p < indices.length; p++) {
    const color = palette[indices[p]] ?? [0, 0, 0];
    data[p * 4] = color[0];
    data[p * 4 + 1] = color[1];
    data[p * 4 + 2] = color[2];
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}

function pcxRleEncode(row: Uint8Array): Uint8Array {
  const writer = new ByteWriter();
  let p = 0;
  while (p < row.length) {
    let run = 1;
    while (p + run < row.length && row[p + run] === row[p] && run < 63) run++;
    const value = row[p];
    if (run > 1 || value >= 0xc0) writer.u8(0xc0 | run);
    writer.u8(value);
    p += run;
  }
  return writer.finish();
}

export function encodePcx(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const bytesPerLine = width + (width & 1);
  const writer = new ByteWriter();
  writer.u8(10).u8(5).u8(1).u8(8);
  writer.u16le(0).u16le(0).u16le(width - 1).u16le(height - 1);
  writer.u16le(72).u16le(72);
  writer.zeros(48);
  writer.u8(0).u8(4).u16le(bytesPerLine).u16le(1).u16le(width).u16le(height).zeros(54);
  for (let y = 0; y < height; y++) {
    for (let channel = 0; channel < 4; channel++) {
      const row = new Uint8Array(bytesPerLine);
      for (let x = 0; x < width; x++) row[x] = rgba[(y * width + x) * 4 + channel];
      writer.bytes(pcxRleEncode(row));
    }
  }
  return writer.finish();
}

function pcxRleDecode(bytes: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  const reader = new ByteReader(bytes);
  let p = 0;
  while (!reader.eof && p < expected) {
    const byte = reader.u8();
    if ((byte & 0xc0) === 0xc0) {
      const count = byte & 0x3f;
      const value = reader.u8();
      for (let i = 0; i < count && p < expected; i++) out[p++] = value;
    } else {
      out[p++] = byte;
    }
  }
  return out;
}

export function decodePcx(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.u8() !== 10) throw new Error('Invalid PCX signature.');
  const version = reader.u8();
  const encoding = reader.u8();
  const bits = reader.u8();
  const xMin = reader.u16le();
  const yMin = reader.u16le();
  const xMax = reader.u16le();
  const yMax = reader.u16le();
  reader.skip(4 + 48);
  reader.u8();
  const planes = reader.u8();
  const bytesPerLine = reader.u16le();
  reader.skip(60);
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  if (bits !== 8 || !planes || !bytesPerLine) throw new Error('Unsupported PCX pixel format.');
  const payload = bytes.subarray(128);
  const expected = bytesPerLine * planes * height;
  const raw = encoding === 1 ? pcxRleDecode(payload, expected) : payload.subarray(0, expected);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let plane = 0; plane < planes; plane++) {
      const row = (y * planes + plane) * bytesPerLine;
      for (let x = 0; x < width; x++) data[(y * width + x) * 4 + plane] = raw[row + x] ?? 0;
    }
  }
  if (planes === 1) {
    const paletteMarker = payload[payload.length - 769];
    if (version >= 5 && paletteMarker === 0x0c) {
      const palette = payload.subarray(payload.length - 768);
      for (let p = 0; p < width * height; p++) {
        const index = data[p * 4];
        data[p * 4] = palette[index * 3] ?? 0;
        data[p * 4 + 1] = palette[index * 3 + 1] ?? 0;
        data[p * 4 + 2] = palette[index * 3 + 2] ?? 0;
        data[p * 4 + 3] = 255;
      }
    } else {
      for (let p = 0; p < width * height; p++) {
        const gray = data[p * 4];
        data[p * 4 + 1] = gray;
        data[p * 4 + 2] = gray;
      }
    }
  } else if (planes === 3) {
    for (let p = 0; p < width * height; p++) data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}

function writeVarint(writer: ByteWriter, value: number) {
  const bytes: number[] = [];
  let current = Math.max(0, value);
  do {
    bytes.unshift(current & 0x7f);
    current = Math.floor(current / 128);
  } while (current > 0);
  for (let i = 0; i < bytes.length; i++) writer.u8(bytes[i] | (i < bytes.length - 1 ? 0x80 : 0));
}

export function encodeWbmp(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const writer = new ByteWriter();
  writer.u8(0).u8(0);
  writeVarint(writer, width);
  writeVarint(writer, height);
  for (let y = 0; y < height; y++) {
    for (let byte = 0; byte < rowBytes; byte++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byte * 8 + bit;
        if (x >= width) continue;
        const p = (y * width + x) * 4;
        const luminance = (rgba[p] + rgba[p + 1] + rgba[p + 2]) / 3;
        if (luminance < 128) value |= 0x80 >> bit;
      }
      writer.u8(value);
    }
  }
  return writer.finish();
}

export function decodeWbmp(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  const type = reader.u8();
  reader.u8();
  if (type !== 0) throw new Error('Unsupported WBMP type.');
  const width = reader.varint();
  const height = reader.varint();
  const rowBytes = Math.ceil(width / 8);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let byte = 0; byte < rowBytes; byte++) {
      const value = reader.u8();
      for (let bit = 0; bit < 8; bit++) {
        const x = byte * 8 + bit;
        if (x >= width) continue;
        const gray = value & (0x80 >> bit) ? 0 : 255;
        const dst = (y * width + x) * 4;
        data[dst] = gray;
        data[dst + 1] = gray;
        data[dst + 2] = gray;
        data[dst + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

export function encodeXbm(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowBytes = Math.ceil(width / 8);
  const values: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let byte = 0; byte < rowBytes; byte++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byte * 8 + bit;
        if (x >= width) continue;
        const p = (y * width + x) * 4;
        const luminance = (rgba[p] + rgba[p + 1] + rgba[p + 2]) / 3;
        if (luminance < 128) value |= 1 << bit;
      }
      values.push(`0x${value.toString(16).padStart(2, '0')}`);
    }
  }
  return encodeText(
    `#define image_width ${width}\n#define image_height ${height}\nstatic unsigned char image_bits[] = { ${values.join(', ')} };\n`,
  );
}

export function decodeXbm(bytes: Uint8Array): Raster {
  const text = decodeText(bytes);
  const width = Number(/#define\s+\w*width\s+(\d+)/.exec(text)?.[1] ?? 0);
  const height = Number(/#define\s+\w*height\s+(\d+)/.exec(text)?.[1] ?? 0);
  const body = /=?\s*\{([\s\S]*?)\}/.exec(text)?.[1] ?? '';
  const values = [...body.matchAll(/0x([0-9a-fA-F]+)/g)].map((match) => Number.parseInt(match[1], 16));
  if (!width || !height || values.length < Math.ceil(width / 8) * height) throw new Error('Invalid XBM data.');
  const rowBytes = Math.ceil(width / 8);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = values[y * rowBytes + (x >> 3)] ?? 0;
      const gray = value & (1 << (x & 7)) ? 0 : 255;
      const dst = (y * width + x) * 4;
      data[dst] = gray;
      data[dst + 1] = gray;
      data[dst + 2] = gray;
      data[dst + 3] = 255;
    }
  }
  return { width, height, data };
}

const XPM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function xpmKey(index: number): string {
  return XPM_CHARS[Math.floor(index / XPM_CHARS.length)] + XPM_CHARS[index % XPM_CHARS.length];
}

export function encodeXpm(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const { palette, indices } = quantizeRgba(rgba, 256);
  const lines = ['/* XPM */', 'static char * image[] = {', `"${width} ${height} ${palette.length} 2"`];
  palette.forEach((color, index) => {
    const hex = [color[0], color[1], color[2]].map((value) => value.toString(16).padStart(2, '0')).join('');
    lines.push(color[3] === 0 ? `"${xpmKey(index)} c None"` : `"${xpmKey(index)} c #${hex}"`);
  });
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) row += xpmKey(indices[y * width + x]);
    lines.push(`"${row}"`);
  }
  lines.push('};');
  return encodeText(lines.join('\n') + '\n');
}

function parseXpmColor(value: string): [number, number, number, number] {
  const color = value.trim();
  if (/^none$/i.test(color)) return [0, 0, 0, 0];
  const named: Record<string, [number, number, number, number]> = {
    black: [0, 0, 0, 255],
    white: [255, 255, 255, 255],
    red: [255, 0, 0, 255],
    green: [0, 255, 0, 255],
    blue: [0, 0, 255, 255],
  };
  if (named[color.toLowerCase()]) return named[color.toLowerCase()];
  const hex = color.replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [Number.parseInt(hex[0] + hex[0], 16), Number.parseInt(hex[1] + hex[1], 16), Number.parseInt(hex[2] + hex[2], 16), 255];
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16), 255];
  }
  return [0, 0, 0, 255];
}

export function decodeXpm(bytes: Uint8Array): Raster {
  const text = decodeText(bytes);
  const strings = [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
  if (!strings.length) throw new Error('Invalid XPM source.');
  const header = strings[0].trim().split(/\s+/).map(Number);
  const width = header[0];
  const height = header[1];
  const colorCount = header[2];
  const charsPerPixel = header[3] ?? 1;
  if (!width || !height || !colorCount) throw new Error('Invalid XPM header.');
  const colors = new Map<string, [number, number, number, number]>();
  for (let i = 1; i <= colorCount; i++) {
    const line = strings[i] ?? '';
    const match = /^(.{1,4})\s+c\s+(.+)$/.exec(line);
    if (match) colors.set(match[1], parseXpmColor(match[2]));
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = strings[1 + colorCount + y] ?? '';
    for (let x = 0; x < width; x++) {
      const key = row.slice(x * charsPerPixel, (x + 1) * charsPerPixel);
      const color = colors.get(key) ?? [0, 0, 0, 255];
      data.set(color, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function encodeFarbfeld(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii('farbfeld').u32be(width).u32be(height);
  for (const value of rgba) writer.u16be(value * 257);
  return writer.finish();
}

export function decodeFarbfeld(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.ascii(8) !== 'farbfeld') throw new Error('Invalid farbfeld signature.');
  const width = reader.u32be();
  const height = reader.u32be();
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(reader.u16be() / 257);
  return { width, height, data };
}

/* -------------------------------------------------------------------------- */
/* Netpbm, Sun raster, FITS and Photoshop documents                           */
/* -------------------------------------------------------------------------- */

export type NetpbmFormat = 'pbm' | 'pgm' | 'ppm' | 'pam' | 'pnm';

export function encodeNetpbm(rgba: Uint8ClampedArray, width: number, height: number, format: NetpbmFormat): Uint8Array {
  const writer = new ByteWriter();
  if (format === 'pbm') {
    writer.ascii(`P4\n${width} ${height}\n`);
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let byte = 0; byte < rowBytes; byte++) {
        let value = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byte * 8 + bit;
          if (x >= width) continue;
          const p = (y * width + x) * 4;
          const luminance = (rgba[p] + rgba[p + 1] + rgba[p + 2]) / 3;
          if (luminance < 128) value |= 0x80 >> bit;
        }
        writer.u8(value);
      }
    }
  } else if (format === 'pgm') {
    writer.ascii(`P5\n${width} ${height}\n255\n`);
    for (let p = 0; p < rgba.length; p += 4) {
      writer.u8(Math.round((rgba[p] + rgba[p + 1] + rgba[p + 2]) / 3));
    }
  } else if (format === 'ppm' || format === 'pnm') {
    writer.ascii(`P6\n${width} ${height}\n255\n`);
    writer.bytes(rasterToRgb({ width, height, data: new Uint8ClampedArray(rgba) }));
  } else {
    writer.ascii(
      `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`,
    );
    writer.bytes(rgba);
  }
  return writer.finish();
}

function isWhitespace(byte: number): boolean {
  return byte === 32 || byte === 9 || byte === 10 || byte === 13 || byte === 12;
}

function pnmHeaderTokens(bytes: Uint8Array, count: number): Array<{ value: string; end: number }> {
  const tokens: Array<{ value: string; end: number }> = [];
  let p = 0;
  while (tokens.length < count && p < bytes.length) {
    while (p < bytes.length && (isWhitespace(bytes[p]) || bytes[p] === 0x23)) {
      if (bytes[p] === 0x23) {
        while (p < bytes.length && bytes[p] !== 10) p++;
      } else {
        p++;
      }
    }
    const start = p;
    while (p < bytes.length && !isWhitespace(bytes[p]) && bytes[p] !== 0x23) p++;
    if (p > start) tokens.push({ value: decodeText(bytes.subarray(start, p)), end: p });
  }
  return tokens;
}

function pnmDataOffset(bytes: Uint8Array, headerEnd: number): number {
  let p = headerEnd;
  if (bytes[p] === 13 && bytes[p + 1] === 10) return p + 2;
  if (p < bytes.length && isWhitespace(bytes[p])) return p + 1;
  return p;
}

function scalePnm(value: number, maxVal: number): number {
  return Math.max(0, Math.min(255, Math.round((value * 255) / Math.max(1, maxVal))));
}

export function decodeNetpbm(bytes: Uint8Array): Raster {
  const firstToken = pnmHeaderTokens(bytes, 1)[0];
  if (!firstToken) throw new Error('Invalid Netpbm header.');
  const magic = firstToken.value;
  if (magic === 'P7') {
    const endHeader = findSequence(bytes, 'ENDHDR');
    if (endHeader < 0) throw new Error('Invalid PAM header.');
    const header = decodeText(bytes.subarray(0, endHeader + 6));
    const width = Number(/WIDTH\s+(\d+)/.exec(header)?.[1] ?? 0);
    const height = Number(/HEIGHT\s+(\d+)/.exec(header)?.[1] ?? 0);
    const depth = Number(/DEPTH\s+(\d+)/.exec(header)?.[1] ?? 0);
    const maxVal = Number(/MAXVAL\s+(\d+)/.exec(header)?.[1] ?? 255);
    const tuple = /TUPLTYPE\s+(\S+)/.exec(header)?.[1] ?? '';
    if (!width || !height || !depth) throw new Error('Invalid PAM dimensions.');
    let p = endHeader + 6;
    while (p < bytes.length && bytes[p] !== 10) p++;
    p++;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const source = p + i * depth;
      if (tuple === 'GRAYSCALE' || depth === 1) {
        const gray = scalePnm(bytes[source], maxVal);
        data[i * 4] = gray;
        data[i * 4 + 1] = gray;
        data[i * 4 + 2] = gray;
        data[i * 4 + 3] = 255;
      } else {
        data[i * 4] = scalePnm(bytes[source], maxVal);
        data[i * 4 + 1] = scalePnm(bytes[source + 1], maxVal);
        data[i * 4 + 2] = scalePnm(bytes[source + 2], maxVal);
        data[i * 4 + 3] = tuple === 'RGB_ALPHA' || depth === 4 ? scalePnm(bytes[source + 3], maxVal) : 255;
      }
    }
    return { width, height, data };
  }
  const tokenCount = magic === 'P1' || magic === 'P4' ? 3 : 4;
  const tokens = pnmHeaderTokens(bytes, tokenCount);
  if (tokens.length < tokenCount || tokens[0].value !== magic) throw new Error('Unsupported Netpbm magic.');
  const width = Number(tokens[1].value);
  const height = Number(tokens[2].value);
  const maxVal = tokenCount === 4 ? Number(tokens[3].value) : 1;
  if (!width || !height) throw new Error('Invalid Netpbm dimensions.');
  const data = new Uint8ClampedArray(width * height * 4);
  if (magic === 'P1' || magic === 'P2' || magic === 'P3') {
    const clean = decodeText(bytes).replace(/#[^\r\n]*/g, ' ');
    const values = clean.trim().split(/\s+/).map(Number);
    const first = tokenCount;
    if (magic === 'P1') {
      for (let i = 0; i < width * height; i++) {
        const gray = values[first + i] ? 0 : 255;
        data.set([gray, gray, gray, 255], i * 4);
      }
    } else if (magic === 'P2') {
      for (let i = 0; i < width * height; i++) {
        const gray = scalePnm(values[first + i] ?? 0, maxVal);
        data.set([gray, gray, gray, 255], i * 4);
      }
    } else {
      for (let i = 0; i < width * height; i++) {
        const r = scalePnm(values[first + i * 3] ?? 0, maxVal);
        const g = scalePnm(values[first + i * 3 + 1] ?? 0, maxVal);
        const b = scalePnm(values[first + i * 3 + 2] ?? 0, maxVal);
        data.set([r, g, b, 255], i * 4);
      }
    }
  } else {
    const offset = pnmDataOffset(bytes, tokens[tokenCount - 1].end);
    if (magic === 'P4') {
      const rowBytes = Math.ceil(width / 8);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = bytes[offset + y * rowBytes + (x >> 3)] ?? 0;
          const gray = value & (0x80 >> (x & 7)) ? 0 : 255;
          data.set([gray, gray, gray, 255], (y * width + x) * 4);
        }
      }
    } else if (magic === 'P5') {
      for (let i = 0; i < width * height; i++) {
        const gray = scalePnm(bytes[offset + i] ?? 0, maxVal);
        data.set([gray, gray, gray, 255], i * 4);
      }
    } else if (magic === 'P6') {
      for (let i = 0; i < width * height; i++) {
        const r = scalePnm(bytes[offset + i * 3] ?? 0, maxVal);
        const g = scalePnm(bytes[offset + i * 3 + 1] ?? 0, maxVal);
        const b = scalePnm(bytes[offset + i * 3 + 2] ?? 0, maxVal);
        data.set([r, g, b, 255], i * 4);
      }
    } else {
      throw new Error(`Unsupported Netpbm magic ${magic}.`);
    }
  }
  return { width, height, data };
}

export function decodePnm(bytes: Uint8Array): Raster {
  return decodeNetpbm(bytes);
}

const RAS_MAGIC = 0x59a66a95;

export function encodeRas(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u32be(RAS_MAGIC).u32be(width).u32be(height).u32be(32).u32be(width * height * 4);
  writer.u32be(1).u32be(0).u32be(0);
  for (let p = 0; p < rgba.length; p += 4) {
    writer.u8(rgba[p + 2]).u8(rgba[p + 1]).u8(rgba[p]).u8(rgba[p + 3]);
  }
  return writer.finish();
}

export function decodeRas(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.u32be() !== RAS_MAGIC) throw new Error('Invalid Sun Raster signature.');
  const width = reader.u32be();
  const height = reader.u32be();
  const depth = reader.u32be();
  const length = reader.u32be();
  const type = reader.u32be();
  const mapType = reader.u32be();
  const mapLength = reader.u32be();
  if (depth !== 24 && depth !== 32) throw new Error('Unsupported Sun Raster depth.');
  if (type > 2) throw new Error('Unsupported Sun Raster compression.');
  reader.skip(mapType === 1 ? mapLength : 0);
  const pixelBytes = depth / 8;
  const payload = bytes.subarray(32 + (mapType === 1 ? mapLength : 0), 32 + (mapType === 1 ? mapLength : 0) + Math.min(length, width * height * pixelBytes));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const source = p * pixelBytes;
    data[p * 4] = payload[source + 2] ?? 0;
    data[p * 4 + 1] = payload[source + 1] ?? 0;
    data[p * 4 + 2] = payload[source] ?? 0;
    data[p * 4 + 3] = pixelBytes === 4 ? payload[source + 3] ?? 255 : 255;
  }
  return { width, height, data };
}

function fitsCard(keyword: string, value: string, comment = ''): string {
  if (!value) return keyword.padEnd(80, ' ');
  const card = `${keyword.padEnd(8, ' ')}= ${value.padStart(20, ' ')}${comment ? ` / ${comment}` : ''}`;
  return card.padEnd(80, ' ');
}

export function encodeFits(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const header = [
    fitsCard('SIMPLE', 'T', 'conforms to FITS standard'),
    fitsCard('BITPIX', '8', '8 bit unsigned integer'),
    fitsCard('NAXIS', '3', 'RGB image cube'),
    fitsCard('NAXIS1', String(width), 'width'),
    fitsCard('NAXIS2', String(height), 'height'),
    fitsCard('NAXIS3', '3', 'red green blue'),
    fitsCard('EXTEND', 'T', 'extensions permitted'),
    fitsCard('END', ''),
  ].join('');
  const headerBytes = encodeText(header);
  const headerBlocks = Math.max(1, Math.ceil(headerBytes.length / 2880));
  const writer = new ByteWriter();
  writer.bytes(headerBytes).zeros(headerBlocks * 2880 - headerBytes.length);
  const planes = rasterToRgb({ width, height, data: new Uint8ClampedArray(rgba) });
  const red = new Uint8Array(width * height);
  const green = new Uint8Array(width * height);
  const blue = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    red[i] = planes[i * 3];
    green[i] = planes[i * 3 + 1];
    blue[i] = planes[i * 3 + 2];
  }
  writer.bytes(red).bytes(green).bytes(blue);
  const padding = (2880 - ((writer.length - headerBlocks * 2880) % 2880)) % 2880;
  writer.zeros(padding);
  return writer.finish();
}

export function decodeFits(bytes: Uint8Array): Raster {
  const text = decodeText(bytes.subarray(0, Math.min(bytes.length, 2880 * 16)));
  if (!text.startsWith('SIMPLE')) throw new Error('Invalid FITS header.');
  const cards = Array.from({ length: Math.floor(text.length / 80) }, (_, i) => text.slice(i * 80, (i + 1) * 80));
  const card = (keyword: string) => cards.find((entry) => entry.slice(0, 8).trim() === keyword)?.slice(10).split('/')[0].trim();
  const bitPix = Number(card('BITPIX') ?? 8);
  const naxis = Number(card('NAXIS') ?? 0);
  const width = Number(card('NAXIS1') ?? 0);
  const height = Number(card('NAXIS2') ?? 0);
  const depth = Number(card('NAXIS3') ?? 1);
  if (bitPix !== 8 || !width || !height) throw new Error('Unsupported FITS image layout.');
  const endCard = cards.findIndex((entry) => entry.slice(0, 8).trim() === 'END');
  if (endCard < 0) throw new Error('FITS END card is missing.');
  const headerBlocks = Math.ceil((endCard + 1) * 80 / 2880);
  const offset = headerBlocks * 2880;
  const data = new Uint8ClampedArray(width * height * 4);
  const planeSize = width * height;
  if (naxis <= 2 || depth === 1) {
    for (let i = 0; i < planeSize; i++) {
      const gray = bytes[offset + i] ?? 0;
      data.set([gray, gray, gray, 255], i * 4);
    }
  } else {
    for (let i = 0; i < planeSize; i++) {
      data[i * 4] = bytes[offset + i] ?? 0;
      data[i * 4 + 1] = bytes[offset + planeSize + i] ?? 0;
      data[i * 4 + 2] = bytes[offset + planeSize * 2 + i] ?? 0;
      data[i * 4 + 3] = depth >= 4 ? bytes[offset + planeSize * 3 + i] ?? 255 : 255;
    }
  }
  return { width, height, data };
}

function packBitsDecode(reader: ByteReader, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  let p = 0;
  while (p < expected && !reader.eof) {
    const raw = reader.u8();
    const code = raw > 127 ? raw - 256 : raw;
    if (code >= 0) {
      const count = code + 1;
      for (let i = 0; i < count && p < expected; i++) out[p++] = reader.u8();
    } else if (code !== -128) {
      const count = 1 - code;
      const value = reader.u8();
      for (let i = 0; i < count && p < expected; i++) out[p++] = value;
    }
  }
  return out;
}

export function encodePsd(rgba: Uint8ClampedArray, width: number, height: number, psb = false): Uint8Array {
  const writer = new ByteWriter();
  writer.ascii('8BPS').u16be(psb ? 2 : 1).zeros(6).u16be(4);
  writer.u32be(height).u32be(width).u16be(8).u16be(3);
  writer.u32be(0).u32be(0);
  if (psb) writer.u64be(0);
  else writer.u32be(0);
  writer.u16be(0);
  for (let channel = 0; channel < 4; channel++) {
    for (let p = 0; p < width * height; p++) writer.u8(rgba[p * 4 + channel]);
  }
  return writer.finish();
}

export function decodePsd(bytes: Uint8Array): Raster {
  const reader = new ByteReader(bytes);
  if (reader.ascii(4) !== '8BPS') throw new Error('Invalid PSD signature.');
  const version = reader.u16be();
  if (version !== 1 && version !== 2) throw new Error('Unsupported PSD version.');
  reader.skip(6);
  const channels = reader.u16be();
  const height = reader.u32be();
  const width = reader.u32be();
  const depth = reader.u16be();
  const colorMode = reader.u16be();
  const colorModeLength = reader.u32be();
  reader.skip(colorModeLength);
  const resourcesLength = reader.u32be();
  reader.skip(resourcesLength);
  const layerLength = version === 2 ? reader.u64be() : reader.u32be();
  reader.skip(layerLength);
  const compression = reader.u16be();
  if (depth !== 8 && depth !== 16) throw new Error('Unsupported PSD bit depth.');
  if (compression !== 0 && compression !== 1) throw new Error('Unsupported PSD compression.');
  const bytesPerSample = depth / 8;
  const planeSize = width * height * bytesPerSample;
  const planes: Uint8Array[] = [];
  if (compression === 0) {
    for (let channel = 0; channel < channels; channel++) planes.push(new Uint8Array(reader.bytes(planeSize)));
  } else {
    const rowCounts: number[] = [];
    for (let i = 0; i < channels * height; i++) rowCounts.push(version === 2 ? reader.u32be() : reader.u16be());
    let rowIndex = 0;
    for (let channel = 0; channel < channels; channel++) {
      const plane = new Uint8Array(planeSize);
      for (let y = 0; y < height; y++) {
        const length = rowCounts[rowIndex++] ?? 0;
        const compressed = new Uint8Array(reader.bytes(length));
        const row = packBitsDecode(new ByteReader(compressed), width * bytesPerSample);
        plane.set(row, y * width * bytesPerSample);
      }
      planes.push(plane);
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const sample = (plane: Uint8Array, index: number) => {
    const offset = index * bytesPerSample;
    return bytesPerSample === 2 ? plane[offset] : plane[offset];
  };
  for (let p = 0; p < width * height; p++) {
    if (colorMode === 1) {
      const gray = sample(planes[0] ?? [], p);
      data[p * 4] = gray;
      data[p * 4 + 1] = gray;
      data[p * 4 + 2] = gray;
      data[p * 4 + 3] = channels > 1 ? sample(planes[1] ?? [], p) : 255;
    } else if (colorMode === 4 && channels >= 4) {
      const c = sample(planes[0] ?? [], p);
      const m = sample(planes[1] ?? [], p);
      const y = sample(planes[2] ?? [], p);
      const k = sample(planes[3] ?? [], p);
      data[p * 4] = Math.round((255 - c) * (255 - k) / 255);
      data[p * 4 + 1] = Math.round((255 - m) * (255 - k) / 255);
      data[p * 4 + 2] = Math.round((255 - y) * (255 - k) / 255);
      data[p * 4 + 3] = channels > 4 ? sample(planes[4] ?? [], p) : 255;
    } else {
      data[p * 4] = sample(planes[0] ?? [], p);
      data[p * 4 + 1] = sample(planes[1] ?? [], p);
      data[p * 4 + 2] = sample(planes[2] ?? [], p);
      data[p * 4 + 3] = channels > 3 ? sample(planes[3] ?? [], p) : 255;
    }
  }
  return { width, height, data };
}

export function encodePsb(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  return encodePsd(rgba, width, height, true);
}

export async function decodePsdAdvanced(bytes: Uint8Array): Promise<Raster> {
  const agPsd = (await import('ag-psd')) as unknown as {
    readPsd: (buffer: ArrayBuffer, options: Record<string, unknown>) => {
      width: number;
      height: number;
      imageData?: { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
    };
  };
  const buffer = sliceBytes(bytes).buffer as ArrayBuffer;
  const psd = agPsd.readPsd(buffer, {
    useImageData: true,
    skipLayerImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
    imageResourcesWhitelist: [],
    totalMemoryLimit: 512 * 1024 * 1024,
  });
  if (!psd.imageData?.data) throw new Error('PSD composite image data is missing.');
  return rasterFromRgba(new Uint8ClampedArray(psd.imageData.data), psd.width, psd.height);
}

export function encodeSgiRleRow(row: Uint8Array): Uint8Array {
  return sgiRleRow(row);
}

/* -------------------------------------------------------------------------- */
/* Advanced WASM-backed codecs with explicit binary initialization           */
/* -------------------------------------------------------------------------- */

const wasmModuleCache = new Map<string, Promise<unknown>>();

async function readWasmBinary(url: string): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof location !== 'undefined') url = new URL(url, location.href).href;
  if (url.startsWith('data:')) {
    const base64 = url.slice(url.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  if (url.startsWith('file:')) {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const specifier = 'node:fs/promises';
      const fsModule = await import(/* @vite-ignore */ specifier);
      return new Uint8Array(await fsModule.readFile(new URL(url)));
    }
    // Chromium allows local file reads via XHR from a file:// Electron page;
    // fetch rejects file URLs even when the asset is packaged alongside the app.
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', url);
      request.responseType = 'arraybuffer';
      request.onload = () => request.response ? resolve(new Uint8Array(request.response)) : reject(new Error('Empty codec runtime'));
      request.onerror = () => reject(new Error('Unable to read local codec runtime'));
      request.send();
    });
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch codec runtime: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer()) as Uint8Array<ArrayBuffer>;
}

async function loadJsQuashCodec<T>(key: string, wasmUrl: string): Promise<T> {
  const cached = wasmModuleCache.get(key) as Promise<T> | undefined;
  if (cached) return cached;
  const pending = (async () => {
    const binary = await readWasmBinary(wasmUrl);
    const compiled = await WebAssembly.compile(binary as BufferSource);
    return compiled as unknown as T;
  })();
  wasmModuleCache.set(key, pending as Promise<unknown>);
  return pending;
}

function imageDataLike(raster: Raster): { data: Uint8ClampedArray; width: number; height: number } {
  return { data: new Uint8ClampedArray(raster.data), width: raster.width, height: raster.height };
}

function normalizeImageData(value: unknown, width: number, height: number): Raster {
  const data = value as { data?: ArrayLike<number>; width?: number; height?: number } | undefined;
  if (!data?.data) throw new Error('WASM codec returned no image data.');
  return rasterFromRgba(
    new Uint8ClampedArray(data.data),
    Number(data.width ?? width),
    Number(data.height ?? height),
  );
}

export async function encodeJxl(raster: Raster, options: Record<string, unknown> = {}): Promise<Uint8Array> {
  const encodedOptions = options;
  const { init, default: encode } = await import('@jsquash/jxl/encode.js');
  const wasm = await loadJsQuashCodec<WebAssembly.Module>('jxl-enc', jxlEncWasmUrl);
  await init(wasm);
  const result = await encode(imageDataLike(raster) as ImageData, { lossless: true, effort: 3, ...encodedOptions });
  return new Uint8Array(result);
}

export async function decodeJxl(bytes: Uint8Array): Promise<Raster> {
  const { init, default: decode } = await import('@jsquash/jxl/decode.js');
  const wasm = await loadJsQuashCodec<WebAssembly.Module>('jxl-dec', jxlDecWasmUrl);
  await init(wasm);
  return normalizeImageData(await decode(sliceBytes(bytes).buffer as ArrayBuffer), 1, 1);
}

export async function encodeAvif(raster: Raster, options: Record<string, unknown> = {}): Promise<Uint8Array> {
  const { init, default: encode } = await import('@jsquash/avif/encode.js');
  const wasm = await loadJsQuashCodec<WebAssembly.Module>('avif-enc', avifEncWasmUrl);
  await init(wasm);
  const result = await encode(imageDataLike(raster) as ImageData, { speed: 8, ...options });
  return new Uint8Array(result);
}

export async function decodeAvif(bytes: Uint8Array): Promise<Raster> {
  const { init, default: decode } = await import('@jsquash/avif/decode.js');
  const wasm = await loadJsQuashCodec<WebAssembly.Module>('avif-dec', avifDecWasmUrl);
  await init(wasm);
  return normalizeImageData(await decode(sliceBytes(bytes).buffer as ArrayBuffer), 1, 1);
}

export async function decodeHeic(bytes: Uint8Array, type: 'image/jpeg' | 'image/png' = 'image/png'): Promise<Raster> {
  const { heicTo } = await import('heic-to/csp');
  const blob = new Blob([sliceBytes(bytes)], { type: 'image/heic' });
  const result = await heicTo({ blob, type, quality: 0.95 });
  if (typeof ImageBitmap !== 'undefined' && result instanceof ImageBitmap) return rasterFromImageBitmap(result);
  const converted = new Uint8Array(await (result as Blob).arrayBuffer());
  return decodeBytesAuto(converted);
}

export async function encodeJp2(raster: Raster): Promise<Uint8Array> {
  const factory = (await import('@cornerstonejs/codec-openjpeg/wasmjs')).default as unknown as (options: {
    wasmBinary: Uint8Array;
  }) => Promise<{
    J2KEncoder: new () => {
      setDecompositions(value: number): void;
      encode(): void;
      getEncodedBuffer(): Uint8Array;
      delete(): void;
    };
  }>;
  const wasmBinary = await readWasmBinary(openJpegWasmUrl);
  const module = await factory({ wasmBinary });
  const encoder = new module.J2KEncoder();
  try {
    encoder.setDecompositions(1);
    const frame = encoder as unknown as {
      getDecodedBuffer?: (info: Record<string, number | boolean>) => Uint8Array;
    };
    const rgb = rasterToRgb(raster);
    const input = new Uint8Array(raster.width * raster.height * 3);
    input.set(rgb);
    if (frame.getDecodedBuffer) {
      frame.getDecodedBuffer({
        width: raster.width,
        height: raster.height,
        bitsPerSample: 8,
        componentCount: 3,
        isSigned: false,
      }).set(input);
    } else {
      Object.assign(encoder, { decodedBuffer: input });
    }
    encoder.encode();
    return new Uint8Array(encoder.getEncodedBuffer());
  } finally {
    encoder.delete();
  }
}

export async function decodeJp2(bytes: Uint8Array): Promise<Raster> {
  const factory = (await import('@cornerstonejs/codec-openjpeg/wasmjs')).default as unknown as (options: {
    wasmBinary: Uint8Array;
  }) => Promise<{
    J2KDecoder: new () => {
      getEncodedBuffer(size: number): Uint8Array;
      decode(): void;
      getFrameInfo(): { width: number; height: number; componentCount: number };
      getDecodedBuffer(): Uint8Array;
      delete(): void;
    };
  }>;
  const wasmBinary = await readWasmBinary(openJpegWasmUrl);
  const module = await factory({ wasmBinary });
  const decoder = new module.J2KDecoder();
  try {
    decoder.getEncodedBuffer(bytes.length).set(bytes);
    decoder.decode();
    const info = decoder.getFrameInfo();
    const decoded = decoder.getDecodedBuffer();
    if (info.componentCount >= 3) return rasterFromRgb(decoded, info.width, info.height);
    return rasterFromGray(decoded, info.width, info.height);
  } finally {
    decoder.delete();
  }
}

export async function decodePsdWasm(bytes: Uint8Array): Promise<Raster> {
  return decodePsdAdvanced(bytes);
}

export async function decodePdf(bytes: Uint8Array, pageNumber = 1): Promise<Raster> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable.');
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({ data: sliceBytes(bytes) });
  const documentProxy = await loadingTask.promise;
  try {
    const page = await documentProxy.getPage(Math.min(Math.max(1, pageNumber), documentProxy.numPages));
    const viewport = page.getViewport({ scale: 1 });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return rasterFromCanvas(canvas);
  } finally {
    await documentProxy.destroy();
  }
}

export async function decodeRaw(bytes: Uint8Array): Promise<Raster> {
  try {
    const { LibRaw } = (await import('libraw-wasm')) as unknown as {
      LibRaw: new () => {
        open: (data: Uint8Array) => Promise<void>;
        imageData: () => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;
        dispose?: () => void;
      };
    };
    const raw = new LibRaw();
    try {
      await raw.open(sliceBytes(bytes));
      const image = await raw.imageData();
      if (image?.width && image?.height && image?.data?.length) {
        return rasterFromRgba(new Uint8ClampedArray(image.data), image.width, image.height);
      }
    } finally {
      raw.dispose?.();
    }
  } catch {
    /* fall through to embedded preview extraction */
  }
  return decodeRawPreview(bytes);
}

export function detectImageFormat(bytes: Uint8Array, name = ''): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const text = (count: number) => decodeText(bytes.subarray(0, count));
  if (bytes.length >= 8 && bytes.subarray(0, 8).every((byte, index) => byte === PNG_SIGNATURE[index])) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 12 && text(4) === 'RIFF' && text(12).slice(8) === 'WEBP') return 'webp';
  if (bytes.length >= 12 && text(4) === 'RIFF' && text(12).slice(8) === 'AVIF') return 'avif';
  if (bytes.length >= 12 && text(12).slice(4, 8) === 'ftyp') {
    const brand = text(12).slice(8, 12);
    if (['avif', 'avis'].includes(brand)) return 'avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0x0a) return 'jxl';
  if (bytes.length >= 12 && text(12).slice(4, 12) === 'JXL \r\n\x87\n') return 'jxl';
  if (bytes.length >= 12 && bytes[4] === 0x6a && bytes[5] === 0x50 && bytes[6] === 0x20 && bytes[7] === 0x20) return 'jp2';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0x4f && bytes[2] === 0xff && bytes[3] === 0x51) return 'jp2';
  if (bytes.length >= 6 && text(6) === 'GIF89a') return 'gif';
  if (bytes.length >= 6 && text(6) === 'GIF87a') return 'gif';
  if (bytes.length >= 2 && text(2) === 'BM') return 'bmp';
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'ico';
  if (ext !== 'tga' && bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 2 && bytes[3] === 0 && (bytes[4] || bytes[5])) return 'cur';
  if (bytes.length >= 4 && text(4) === 'icns') return 'icns';
  if (bytes.length >= 4 && text(4) === 'qoif') return 'qoi';
  if (bytes.length >= 2 && (text(2) === 'II' || text(2) === 'MM')) return 'tiff';
  if (bytes.length >= 4 && text(4) === '8BPS') return 'psd';
  if (bytes.length >= 4 && text(4) === '8BPB') return 'psb';
  if (bytes.length >= 5 && text(5) === '%PDF-') return 'pdf';
  if (bytes.length >= 4 && text(4) === '%!PS') return 'eps';
  if (bytes.length >= 8 && text(8) === 'farbfeld') return 'farbfeld';
  if (bytes.length >= 2 && text(2) === 'P7') return 'pam';
  if (bytes.length >= 2 && ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].includes(text(2))) return 'pnm';
  if (bytes.length >= 4 && bytes[0] === 0x59 && bytes[1] === 0xa6 && bytes[2] === 0x6a && bytes[3] === 0x95) return 'ras';
  if (bytes.length >= 4 && text(4) === 'DDS ') return 'dds';
  if (bytes.length >= 12 && bytes.subarray(0, 12).every((byte, index) => byte === KTX_IDENTIFIER[index])) return 'ktx';
  if (bytes.length >= 4 && (text(4) === 'SDPX' || text(4) === 'XPDS')) return 'dpx';
  if (bytes.length >= 4 && bytes[0] === 0x80 && bytes[1] === 0x2a && bytes[2] === 0x5f && bytes[3] === 0xd7) return 'cin';
  if (bytes.length >= 2 && bytes[0] === 0x01 && bytes[1] === 0xda) return 'sgi';
  if (bytes.length >= 4 && text(4) === 'FORM') return 'iff';
  if (bytes.length >= 2 && bytes[0] === 10 && bytes[1] === 5) return 'pcx';
  if (ext === 'tga') return 'tga';
  if (bytes.length >= 2 && bytes[0] === 0 && bytes[1] === 0) return 'wbmp';
  if (text(10).startsWith('#?RADIANCE') || text(6) === '#?RGBE') return 'hdr';
  if (bytes.length >= 2 && text(2) === 'PF') return 'pfm';
  if (bytes.length >= 4 && bytes[0] === 0x76 && bytes[1] === 0x2f && bytes[2] === 0x31 && bytes[3] === 0x01) return 'exr';
  if (bytes.length >= 6 && text(6) === 'SIMPLE') return 'fits';
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  const trimmed = text(512).trimStart();
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) return 'svg';
  if (trimmed.startsWith('#define')) return 'xbm';
  if (trimmed.startsWith('/* XPM */') || trimmed.includes('static char *')) return 'xpm';
  if (ext) return ext;
  return 'unknown';
}

export async function decodeBytesAuto(bytes: Uint8Array, name = ''): Promise<Raster> {
  const format = detectImageFormat(bytes, name);
  switch (format) {
    case 'png':
    case 'apng':
      return decodePng(bytes);
    case 'jpg':
    case 'jpeg':
    case 'jfif':
      return decodeJpeg(bytes);
    case 'bmp':
    case 'dib':
      return decodeBmp(bytes);
    case 'tiff':
    case 'tif':
      try {
        return decodeTiff(bytes);
      } catch {
        return decodeTiffUtif(bytes);
      }
    case 'gif':
      return decodeGif(bytes);
    case 'ico':
      return decodeIcon(bytes, 1);
    case 'cur':
      return decodeCur(bytes);
    case 'icns':
      return decodeIcns(bytes);
    case 'qoi':
      return decodeQoi(bytes);
    case 'svg':
      return decodeWrappedRaster(bytes);
    case 'svgz':
      return decodeSvgz(bytes);
    case 'eps':
    case 'ai':
      return decodeWrappedRaster(bytes);
    case 'pdf':
      try {
        return await decodePdfPreview(bytes);
      } catch {
        return decodePdf(bytes);
      }
    case 'psd':
    case 'psb':
      try {
        return decodePsd(bytes);
      } catch {
        return decodePsdAdvanced(bytes);
      }
    case 'exr':
      return decodeExr(bytes);
    case 'hdr':
      return decodeHdr(bytes);
    case 'pfm':
      return decodePfm(bytes);
    case 'tga':
      return decodeTga(bytes);
    case 'dds':
      return decodeDds(bytes);
    case 'ktx':
      return decodeKtx(bytes);
    case 'dpx':
      return decodeDpx(bytes);
    case 'cin':
      return decodeCin(bytes);
    case 'sgi':
      return decodeSgi(bytes);
    case 'iff':
    case 'lbm':
      return decodeIff(bytes);
    case 'pcx':
      return decodePcx(bytes);
    case 'wbmp':
      return decodeWbmp(bytes);
    case 'xbm':
      return decodeXbm(bytes);
    case 'xpm':
      return decodeXpm(bytes);
    case 'farbfeld':
    case 'ff':
      return decodeFarbfeld(bytes);
    case 'pbm':
    case 'pgm':
    case 'ppm':
    case 'pam':
    case 'pnm':
      return decodeNetpbm(bytes);
    case 'ras':
      return decodeRas(bytes);
    case 'fits':
      return decodeFits(bytes);
    case 'jxl':
      return decodeJxl(bytes);
    case 'avif':
      return decodeAvif(bytes);
    case 'jp2':
    case 'j2k':
      return decodeJp2(bytes);
    case 'heic':
    case 'heif':
      return decodeHeic(bytes);
    case 'dng':
    case 'cr2':
    case 'cr3':
    case 'nef':
    case 'arw':
    case 'raf':
    case 'orf':
    case 'rw2':
    case 'pef':
    case 'srw':
    case 'raw':
      return decodeRaw(bytes);
    case 'zip':
    case 'sketch':
    case 'fig':
    case 'xd':
    case 'ora':
    case 'xcf':
      return decodeZipPreview(bytes);
    default:
      throw new Error(`Unsupported image format: ${format || 'unknown'}.`);
  }
}
