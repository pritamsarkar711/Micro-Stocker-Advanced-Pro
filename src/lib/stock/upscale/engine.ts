import { desktop } from '@/lib/desktop';
import { installModelInApp } from '@/lib/modelStore';
import { upscaleClassic } from './classic';
import {
  buildUpscaleInstallSpec,
  engineBinaryFor,
  resolveTargetSize,
  UPSCALE_MODELS,
  type UpscaleModel,
  type UpscaleTarget,
} from './models';

export interface UpscaleJobInput {
  blob?: Blob;
  path?: string;
  name: string;
  width: number;
  height: number;
  modelId: string;
  target: UpscaleTarget;
  outFormat: 'png' | 'jpg' | 'webp';
  quality: number;
  tileSize?: number;
  onProgress?: (ratio: number, label: string) => void;
}

export interface UpscaleJobResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  megapixels: number;
  usedAi: boolean;
  log?: string;
}

export function planPasses(
  neededFactor: number,
  scales: Array<2 | 3 | 4>,
): { passes: Array<2 | 3 | 4>; tail: number } {
  if (neededFactor <= 1.01) return { passes: [], tail: neededFactor };
  const maxS = scales.includes(4) ? 4 : scales.includes(3) ? 3 : 2;
  const pick = (remain: number): 2 | 3 | 4 => {
    for (const s of [2, 3, 4] as const) {
      if (scales.includes(s) && s >= remain - 0.02) return s;
    }
    return maxS;
  };
  const passes: Array<2 | 3 | 4> = [];
  let achieved = 1;
  while (achieved < neededFactor - 0.02 && passes.length < 2) {
    const step = pick(neededFactor / achieved);
    passes.push(step);
    achieved *= step;
  }
  return { passes, tail: neededFactor / achieved };
}

export function outputFilename(
  sourceName: string,
  target: UpscaleTarget,
  format: 'png' | 'jpg' | 'webp',
): string {
  const dot = sourceName.lastIndexOf('.');
  const base = (dot > 0 ? sourceName.slice(0, dot) : sourceName).replace(/[-–—\s]+/g, '_');
  return `${base}_${target.id}.${format}`;
}

export async function ensureModelInstalled(
  model: UpscaleModel,
): Promise<{ ok: boolean; error?: string; canceled?: boolean }> {
  if (model.family === 'builtin') return { ok: true };
  const spec = buildUpscaleInstallSpec(model);
  if (!spec) return { ok: true };
  const res = await installModelInApp(spec);
  return { ok: res.ok, error: res.error, canceled: res.canceled };
}

export async function runUpscale(job: UpscaleJobInput): Promise<UpscaleJobResult> {
  const model = UPSCALE_MODELS.find((m) => m.id === job.modelId) ?? UPSCALE_MODELS[0];
  const goal = resolveTargetSize(job.width, job.height, job.target);
  const { passes, tail } = planPasses(goal.factor, model.scales);
  const wantAi = model.family !== 'builtin';

  if (wantAi && desktop.isDesktop) {
    if (passes.length === 0) {
      if (!job.blob) throw new Error('Image buffer is missing');
      const resized = await upscaleClassic(job.blob, {
        exactScale: goal.factor,
        mode: 'lanczos-pro',
        outFormat: job.outFormat,
        quality: job.quality,
        onProgress: job.onProgress,
      });
      return {
        blob: resized,
        filename: outputFilename(job.name, job.target, job.outFormat),
        width: goal.width,
        height: goal.height,
        megapixels: +((goal.width * goal.height) / 1_000_000).toFixed(1),
        usedAi: false,
      };
    }

    job.onProgress?.(0.08, `Preparing ${model.name}`);
    const installed = await ensureModelInstalled(model);
    if (!installed.ok) {
      throw new Error(installed.error || 'Model installation failed');
    }

    const runtime = engineBinaryFor(model.family as Exclude<UpscaleModel['family'], 'builtin'>);
    job.onProgress?.(0.2, `Upscaling with ${model.name}`);
    const res = await desktop.upscaler.run({
      inPath: job.path,
      blob: job.path ? undefined : job.blob,
      binary: runtime.binary,
      engineGroup: runtime.group,
      engineFamily: model.family as 'realesrgan' | 'realcugan' | 'waifu2x' | 'realsr' | 'srmd',
      modelsSubDir: model.modelsSubDir,
      modelId: model.ncnnModelName ?? model.id,
      noiseLevel: model.noiseLevel,
      passes,
      tailScale: tail,
      tileSize: job.tileSize ?? 0,
      outFormat: Math.abs(tail - 1) > 0.02 ? 'png' : job.outFormat,
      quality: Math.round(job.quality * 100),
    });
    if (!res.ok || !res.blob) {
      throw new Error(res.error ?? `${model.name} failed`);
    }

    let finalBlob = res.blob;
    if (Math.abs(tail - 1) > 0.02) {
      job.onProgress?.(0.88, `Fitting to ${goal.width} by ${goal.height}`);
      finalBlob = await upscaleClassic(res.blob, {
        exactScale: tail,
        mode: 'plain',
        outFormat: job.outFormat,
        quality: job.quality,
      });
    }
    job.onProgress?.(1, 'Complete');
    return {
      blob: finalBlob,
      filename: outputFilename(job.name, job.target, job.outFormat),
      width: goal.width,
      height: goal.height,
      megapixels: +((goal.width * goal.height) / 1_000_000).toFixed(1),
      usedAi: true,
      log: res.log,
    };
  }

  // Built in commercial upscaler (and graceful browser path)
  if (!job.blob) throw new Error('Image pixels unavailable. Reimport the file.');
  const fallbackMode =
    model.builtinMode ??
    (model.purpose === 'anime'
      ? 'anime4k-shader'
      : model.purpose === 'restore'
        ? 'photo-restore'
        : model.purpose === 'faithful'
          ? 'edge-crisp'
          : 'lanczos-pro');

  const blob = await upscaleClassic(job.blob, {
    exactScale: goal.factor,
    mode: fallbackMode,
    outFormat: job.outFormat,
    quality: job.quality,
    onProgress: job.onProgress,
  });
  return {
    blob,
    filename: outputFilename(job.name, job.target, job.outFormat),
    width: goal.width,
    height: goal.height,
    megapixels: +((goal.width * goal.height) / 1_000_000).toFixed(1),
    usedAi: false,
  };
}
