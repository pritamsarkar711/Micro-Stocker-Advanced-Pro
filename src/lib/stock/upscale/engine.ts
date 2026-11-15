import { desktop, isDesktop } from '@/lib/desktop';
import { PLATFORMS, type PlatformSpec } from '../platforms';
import type { PlatformId, StockItem } from '../types';
import { megapixels } from '../types';
import { upscaleClassic } from './classic';
import { ENGINE_RELEASES, UPSCALE_MODELS } from './models';

export type EngineId = 'classic' | 'realesrgan';

export interface TargetPreset {
  id: string;
  label: string;
  minMP?: number;
  targetWidth?: number;
  platform?: PlatformId;
  note: string;
}

/** 8K UHD = 7680×4320 ≈ 33.2 MP — the highest preset we expose. */
export const MP_8K = 33.2;

export const TARGET_PRESETS: TargetPreset[] = [
  { id: '8k', label: '8K UHD (7680×4320 · 33.2 MP)', targetWidth: 7680, minMP: MP_8K, note: 'Highest preset; stays under Adobe’s 100 MP ceiling.' },
  { id: '4k', label: '4K UHD (3840×2160 · 8.3 MP)', targetWidth: 3840, minMP: 8.3, note: 'Clears every agency minimum including Alamy’s ~6 MP.' },
  { id: 'adobe', label: 'Adobe Stock sweet spot (24 MP)', minMP: 24, note: 'Big crop room, still ≤ 100 MP and ≤ 45 MB when saved at q92.' },
  { id: 'alamy', label: 'Alamy safe (≥ 6 MP / 17 MB uncompressed)', minMP: 6, note: 'Alamy measures uncompressed size: ≈ 6 MP at 8-bit RGB.' },
  { id: 'freepik', label: 'Freepik web panel (4000 px long edge)', targetWidth: 4000, note: 'Inside Freepik’s 2000-10000 px window.' },
  { id: 'min-all', label: 'Clear all minimums (6.5 MP)', minMP: 6.5, note: 'Smallest export that passes Adobe+Shutterstock+Alamy at once.' },
];

export function platformPreset(id: PlatformId): TargetPreset {
  const spec = PLATFORMS[id];
  return {
    id: `platform-${id}`,
    label: `${spec.name} minimum (${spec.minMP} MP)`,
    minMP: spec.minMP,
    platform: id,
    note: spec.highlights.join(' · '),
  };
}

export interface ScalePlan {
  passes: number[];
  finalScale: number;
  reason: string;
}

/** Smallest chain of native model scales (2/3/4) that reaches the target. */
export function planScale(item: StockItem, preset: TargetPreset, maxScale = 16): ScalePlan {
  const mp = megapixels(item) ?? 1;
  const width = item.width ?? 1000;
  let needed = 1;
  if (preset.targetWidth) needed = Math.max(needed, preset.targetWidth / width);
  if (preset.minMP) needed = Math.max(needed, Math.sqrt(preset.minMP / mp));
  needed = Math.min(needed, maxScale);

  const chains: number[][] = [[2], [3], [4], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [2, 2, 4], [4, 4, 2]];
  for (const chain of chains) {
    const total = chain.reduce((a, b) => a * b, 1);
    if (total + 1e-9 >= needed) {
      return { passes: chain, finalScale: total, reason: `${chain.join('×')} = ${total}× reaches the target` };
    }
  }
  return { passes: [4, 4, 4], finalScale: 64, reason: 'capped at 64×' };
}

export interface UpscaleRequest {
  item: StockItem;
  engine: EngineId;
  modelId: string;
  passes: number[];
  outFormat: 'png' | 'jpg' | 'webp';
  quality: number;
  onProgress?: (ratio: number, label: string) => void;
}

export interface UpscaleResult {
  blob: Blob;
  width: number;
  height: number;
  engine: EngineId;
  modelId: string;
  passes: number[];
  ms: number;
}

export function engineAvailability(): { id: EngineId; label: string; available: boolean; why?: string }[] {
  return [
    { id: 'classic', label: 'Built-in high-quality resampler', available: true },
    {
      id: 'realesrgan',
      label: 'Real-ESRGAN NCNN-Vulkan (AI, local GPU)',
      available: isDesktop,
      why: isDesktop ? undefined : 'Desktop build only — the browser preview cannot spawn the native binary.',
    },
  ];
}

export async function ensureRealEsrgan(
  onProgress?: (label: string) => void,
): Promise<{ ok: boolean; path?: string; models?: string[]; error?: string }> {
  if (!isDesktop) return { ok: false, error: 'Requires the packaged desktop app.' };
  onProgress?.('Checking Real-ESRGAN installation…');
  const release = ENGINE_RELEASES[(desktop.platform === 'win32' ? 'win32' : desktop.platform === 'darwin' ? 'darwin' : 'linux') as keyof typeof ENGINE_RELEASES];
  return desktop.upscaler.ensure(release.url, release.binary, UPSCALE_MODELS.map((m) => m.id));
}

export async function runUpscale(sourceBlob: Blob, request: UpscaleRequest): Promise<UpscaleResult> {
  const started = performance.now();

  if (request.engine === 'classic') {
    const total = request.passes.length;
    let blob = sourceBlob;
    for (let i = 0; i < total; i++) {
      const pass = request.passes[i] as 2 | 3 | 4;
      request.onProgress?.(i / total, `Classic pass ${i + 1}/${total} (${pass}×)`);
      blob = await upscaleClassic(blob, {
        scale: pass,
        outFormat: request.outFormat,
        quality: request.quality,
      });
    }
    const dims = await probe(blob);
    return { blob, ...dims, engine: 'classic', modelId: 'canvas-high', passes: request.passes, ms: performance.now() - started };
  }

  // Real-ESRGAN path: the native binary does every pass on the GPU.
  const release = ENGINE_RELEASES[(desktop.platform === 'win32' ? 'win32' : desktop.platform === 'darwin' ? 'darwin' : 'linux') as keyof typeof ENGINE_RELEASES];
  request.onProgress?.(0, 'Starting Real-ESRGAN NCNN-Vulkan…');
  const result = await desktop.upscaler.run({
    inPath: request.item.path,
    blob: request.item.path ? undefined : sourceBlob,
    binary: release.binary,
    modelId: request.modelId,
    passes: request.passes,
    outFormat: request.outFormat,
    quality: request.quality,
  });
  if (!result.ok || !result.blob) throw new Error(result.error ?? 'Upscale failed');
  const dims = await probe(result.blob);
  return { blob: result.blob, ...dims, engine: 'realesrgan', modelId: request.modelId, passes: request.passes, ms: performance.now() - started };
}

async function probe(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

/** Validation helper reused by the Upscale studio and Export centre. */
export function passesPlatform(item: { width?: number; height?: number; sizeBytes: number }, spec: PlatformSpec): boolean {
  if (!item.width || !item.height) return false;
  const mp = (item.width * item.height) / 1_000_000;
  return mp >= spec.minMP && (spec.maxMP === null || mp <= spec.maxMP) && item.sizeBytes / 1_048_576 <= spec.maxFileMB;
}
