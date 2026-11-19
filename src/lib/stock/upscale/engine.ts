import { desktop } from '@/lib/desktop';
import { installModelInApp } from '@/lib/modelStore';
import { upscaleClassic } from './classic';
import {
  buildUpscaleInstallSpec,
  engineBinaryFor,
  isOnnxModel,
  resolveTargetSize,
  UPSCALE_MODELS,
  type NcnnFamily,
  type UpscaleModel,
  type UpscaleTarget,
} from './models';
import { upscaleOnnxImage } from './onnx';

/**
 * How many source pixels the phone's WebAssembly network may chew through in one
 * run. Above this the graph crawls and the tab can be killed for memory, so the
 * engine runs the neural pass on a capped copy and lets the classic resampler
 * carry the rest of the way to the requested size.
 */
const ONNX_PIXEL_LIMIT = 900_000;

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

  // Single graph ONNX models (the mobile neural path) run wherever a WebAssembly
  // backend exists, which is every phone and every desktop build.
  if (isOnnxModel(model)) {
    if (!job.blob) throw new Error('Image pixels unavailable. Reimport the file.');
    job.onProgress?.(0.05, `Preparing ${model.name}`);
    const installed = await ensureModelInstalled(model);
    if (!installed.ok) throw new Error(installed.error || 'Model installation failed');

    const pixels = Math.max(1, job.width * job.height);
    const preScale = pixels > ONNX_PIXEL_LIMIT ? Math.sqrt(ONNX_PIXEL_LIMIT / pixels) : 1;
    if (preScale < 1) {
      job.onProgress?.(0.1, `Neural pass on a ${Math.round(preScale * 100)}% copy, then fitted to target`);
    }
    const neural = await upscaleOnnxImage(job.blob, {
      modelId: model.id,
      fileName: model.onnxFile,
      url: model.onnxUrl,
      scale: model.nativeScale,
      preScale,
      outFormat: Math.abs(goal.factor / (preScale * model.nativeScale) - 1) > 0.02 ? 'png' : job.outFormat,
      quality: job.quality,
      onProgress: (ratio, label) => job.onProgress?.(ratio, label),
    });

    let finalBlob = neural;
    const remaining = goal.factor / (preScale * model.nativeScale);
    if (Math.abs(remaining - 1) > 0.02) {
      job.onProgress?.(0.9, `Fitting to ${goal.width} by ${goal.height}`);
      // The neural pass already added the detail, so the fit to the requested
      // size is a resample: a second convolution over 25 MP would add minutes of
      // work on a phone for no visible gain.
      finalBlob = await upscaleClassic(neural, {
        exactScale: remaining,
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
      log: `onnx:${model.id}`,
    };
  }

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

    const runtime = engineBinaryFor(model.family as NcnnFamily);
    job.onProgress?.(0.2, `Upscaling with ${model.name}`);
    const res = await desktop.upscaler.run({
      inPath: job.path,
      blob: job.path ? undefined : job.blob,
      binary: runtime.binary,
      engineGroup: runtime.group,
      engineFamily: model.family as NcnnFamily,
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
