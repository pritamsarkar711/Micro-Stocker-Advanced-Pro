import type { StockItem } from './types';

/**
 * Near-duplicate detection with a 64-bit dHash (gradient hash).
 *
 * Cheap, deterministic and good enough to catch "I exported the same artwork
 * twice with a different background / slight crop" — the classic reason a
 * whole batch gets rejected for similarity (Vecteezy and Adobe are strict).
 */

export type ImageHash = bigint;

export async function dHash(blob: Blob): Promise<ImageHash> {
  const bitmap = await createImageBitmap(blob);
  const width = 9;
  const height = 8;
  const canvas =
    'OffscreenCanvas' in globalThis
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);

  let hash = 0n;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = grey(data, x, y, width);
      const right = grey(data, x + 1, y, width);
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

function grey(data: Uint8ClampedArray, x: number, y: number, width: number): number {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

export function hamming(a: ImageHash, b: ImageHash): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/** ≤ threshold differing bits = visually near-identical at thumbnail scale. */
export const DUPLICATE_THRESHOLD = 8;

export interface DuplicateCluster {
  items: StockItem[];
  maxDistance: number;
}

export async function findDuplicateClusters(
  items: StockItem[],
  getBlob: (id: string) => Promise<Blob>,
  threshold = DUPLICATE_THRESHOLD,
  onProgress?: (done: number, total: number) => void,
): Promise<DuplicateCluster[]> {
  const hashes: { item: StockItem; hash: ImageHash }[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      hashes.push({ item: items[i], hash: await dHash(await getBlob(items[i].id)) });
    } catch {
      /* unreadable file: skip */
    }
    onProgress?.(i + 1, items.length);
  }

  const clusters: DuplicateCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < hashes.length; i++) {
    if (assigned.has(hashes[i].item.id)) continue;
    const group = [hashes[i]];
    let maxDistance = 0;
    for (let j = i + 1; j < hashes.length; j++) {
      if (assigned.has(hashes[j].item.id)) continue;
      const distance = hamming(hashes[i].hash, hashes[j].hash);
      if (distance <= threshold) {
        group.push(hashes[j]);
        assigned.add(hashes[j].item.id);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    if (group.length > 1) {
      assigned.add(hashes[i].item.id);
      clusters.push({ items: group.map((g) => g.item), maxDistance });
    }
  }
  return clusters;
}
