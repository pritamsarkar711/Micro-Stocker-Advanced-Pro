/**
 * Byte helpers shared by the native download paths.
 *
 * They live apart from the Capacitor plugins so the unit tests can exercise the
 * chunk maths on plain Node, without a WebView or a device.
 */

/** `bytes 0-4194303/7340032` -> 7340032 */
export function parseContentRangeTotal(value: string | undefined): number {
  if (!value) return 0;
  const match = /\/\s*(\d+)\s*$/.exec(value);
  return match ? Number(match[1]) : 0;
}

/** A model id or file name becomes a safe single path segment. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._]+/, '');
  return cleaned || 'part.bin';
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** Native bridges return base64 for binary bodies; the web build returns a buffer. */
export function responseToBytes(data: unknown): Uint8Array {
  if (data == null) return new Uint8Array(0);
  if (typeof data === 'string') return base64ToBytes(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'object') {
    const buffer = (data as { buffer?: ArrayBuffer }).buffer;
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  }
  return new Uint8Array(0);
}

/**
 * The chunk plan for a ranged download: every request after the first asks for
 * exactly `chunk` bytes starting where the previous answer stopped.
 */
export function nextChunkRange(written: number, chunk: number): { start: number; end: number } {
  return { start: written, end: written + chunk - 1 };
}

/** True when the last answer finished the file. */
export function isDownloadComplete(written: number, total: number, lastChunk: number, chunk: number): boolean {
  if (!written) return false;
  if (total > 0) return written >= total;
  return lastChunk < chunk;
}
