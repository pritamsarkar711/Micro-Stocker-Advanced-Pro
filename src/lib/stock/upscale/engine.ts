import { desktop, isDesktop } from '@/lib/desktop';
import type { PlatformSpec } from '../platforms';
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

export interface ScalePlan {
  /** Native 4× passes handed to the model. */
  passes: number[];
  /** Exact multiplier needed to hit the target. */
  finalScale: number;
  /** Resize factor applied after the last pass (≥ 1). */
  tailScale: number;
  reason: string;
}

/** Chain of native 4× model passes that reaches the target, plus a fine tail. */
export function planScale(item: StockItem, preset: TargetPreset, maxScale = 16): ScalePlan {
  const mp = megapixels(item) ?? 1;
  const width = item.width ?? 1000;
  let needed = 1;
  if (preset.targetWidth) needed = Math.max(needed, preset.targetWidth / width);
  if (preset.minMP) needed = Math.max(needed, Math.sqrt(preset.minMP / mp));
  needed = Math.min(needed, maxScale);

  // Shipped NCNN weights are 4x only, so chains are 4, 4x4, 4x4x4.
  // `finalScale` is the exact multiplier; `tailScale` is the final resize that
  // makes up the difference between a 4x pass and the exact target.
  const chains: number[][] = [[4], [4, 4], [4, 4, 4]];
  for (const chain of chains) {
    const total = chain.reduce((a, b) => a * b, 1);
    if (total + 1e-9 >= needed) {
      return {
        passes: chain,
        finalScale: needed,
        tailScale: Math.max(1, needed / total),
        reason: needed === total ? `${total}× in ${chain.length} pass${chain.length === 1 ? '' : 'es'}` : `${total}× then resized to ${needed.toFixed(2)}×`,
      };
    }
  }
  return { passes: [4, 4, 4], finalScale: 64, tailScale: 1, reason: 'capped at 64×' };
}

export interface UpscaleRequest {
  item: StockItem;
  engine: EngineId;
  modelId: string;
  passes: number[];
  /** Extra resize after the AI passes, to land exactly on the target. */
  tailScale?: number;
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

/**
 * The NCNN build only ships 4× weights, so a scale chain is expressed as
 * 4× passes plus one optional final 2× resample done in the renderer.
 * `planScale` therefore returns powers of four only, and the last fractional
 * step is applied by `upscaleClassic` — never by asking the model for a scale
 * it has no weights for.
 */
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
      request.onProgress?.(i / total, `Resampling pass ${i + 1}/${total} (${pass}×)`);
      blob = await upscaleClassic(blob, {
        scale: pass,
        outFormat: request.outFormat,
        quality: request.quality,
      });
    }
    if (request.tailScale && request.tailScale > 1.01) {
      request.onProgress?.(0.95, 'Final resize to target');
      blob = await upscaleClassic(blob, {
        // resampleExact keeps the aspect and lands on the requested width
        exactScale: request.tailScale,
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
    tailScale: request.tailScale,
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
