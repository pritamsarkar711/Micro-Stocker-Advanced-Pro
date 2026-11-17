/**
 * Automatic upscale recommendation.
 *
 * The model catalogue is large, and a wrong pick is expensive: a generative
 * model on flat artwork leaves halos, and a classic resampler on a soft photo
 * leaves it soft. These rules pick a sensible default from the pixels we can
 * actually see (size, aspect, transparency, compression) and always explain
 * why, so the user can accept it in one click or override it.
 */
import { UPSCALE_MODELS, UPSCALE_TARGETS, type UpscaleModel, type UpscalePurpose } from './models';

export interface UpscaleSample {
  width: number;
  height: number;
  bytes: number;
  hasAlpha?: boolean;
  filename?: string;
  format?: string;
}

export interface UpscaleRecommendation {
  /** Model to preselect right now (built in or already installed). */
  modelId: string;
  /** Highest quality model for this image, even if it needs a download. */
  bestModelId: string;
  /** Marketplace or resolution preset that reaches stock size without waste. */
  targetId: string;
  /** One sentence to show next to the recommendation. */
  reason: string;
  /** True when the best model is available without downloading anything. */
  readyNow: boolean;
  needsDownload: boolean;
  /** Detected subject type, useful for the purpose filter. */
  kind: 'photo' | 'art' | 'transparent' | 'small' | 'large';
  /** Output format that will not destroy the source. */
  format: 'jpg' | 'png' | 'webp';
}

const byId = new Map(UPSCALE_MODELS.map((model) => [model.id, model]));

function model(id: string): UpscaleModel {
  return byId.get(id) ?? UPSCALE_MODELS[0];
}

/**
 * Smallest stock preset that reaches the minimum without waste. Images already
 * above a preset's floor are covered by it (factor 1, never a downscale).
 */
function pickTarget(megapixels: number): string {
  const stock = UPSCALE_TARGETS
    .filter((target) => target.group === 'platform' && (target.megapixels ?? 0) > 0)
    .sort((a, b) => (a.megapixels ?? 0) - (b.megapixels ?? 0));
  const covered = stock.filter((target) => megapixels >= (target.megapixels ?? 0));
  if (covered.length) return covered[covered.length - 1].id;
  const fit = stock.find((target) => megapixels <= (target.megapixels ?? 0));
  return fit?.id ?? stock[stock.length - 1]?.id ?? 'shutterstock';
}

/** True for PNG/WebP artwork with flat colour and few unique tones per pixel. */
function looksLikeArt(sample: UpscaleSample, bytesPerPixel: number): boolean {
  const flat = /\.(png|svg|webp)$/i.test(sample.filename ?? '') || ['png', 'webp'].includes(String(sample.format ?? '').toLowerCase());
  return flat && bytesPerPixel < 0.35;
}

export function recommendUpscale(
  sample: UpscaleSample,
  options: { installed?: Record<string, boolean>; isDesktop?: boolean; purpose?: UpscalePurpose } = {},
): UpscaleRecommendation {
  const { installed = {}, isDesktop = false } = options;
  const pixels = Math.max(1, sample.width * sample.height);
  const megapixels = pixels / 1_000_000;
  const bytesPerPixel = sample.bytes > 0 ? sample.bytes / pixels : 0.5;
  const longEdge = Math.max(sample.width, sample.height);
  const art = looksLikeArt(sample, bytesPerPixel);
  const transparent = Boolean(sample.hasAlpha);
  const ready = (id: string) => model(id).family === 'builtin' || Boolean(installed[id]);

  const notes: string[] = [];
  let kind: UpscaleRecommendation['kind'] = 'photo';
  let modelId = 'lanczos-pro';
  let bestModelId = 'realesrgan-x4plus';

  if (transparent) {
    kind = 'transparent';
    modelId = 'edge-crisp';
    bestModelId = 'edge-crisp';
    notes.push('Transparency kept intact.');
  } else if (art) {
    kind = 'art';
    modelId = 'edge-crisp';
    bestModelId = 'realesr-animevideov3';
    notes.push('Flat artwork stays crisp without halos.');
  } else if (bytesPerPixel < 0.18) {
    kind = 'small';
    modelId = 'photo-restore';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Heavily compressed source, so light denoise comes first.');
  } else if (megapixels < 1 || longEdge < 1400) {
    kind = 'small';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Small source: a detail model adds the most.');
  } else if (megapixels >= 24) {
    kind = 'large';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrnet-x4plus';
    notes.push('Already stock sized, so a faithful pass is enough.');
  } else {
    kind = 'photo';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Photo detail without invented texture.');
  }

  // The best model may not be usable yet. Never preselect something the user
  // cannot run: fall back to the strongest ready option.
  let chosen = modelId;
  if (!ready(chosen)) {
    const fallback = ['edge-crisp', 'lanczos-pro', 'photo-restore', 'anime4k-shader'].find((id) => ready(id));
    chosen = fallback ?? 'lanczos-pro';
  }
  const best = bestModelId;
  const bestReady = ready(best);
  const transparentSource = kind === 'transparent';
  const targetId = transparentSource
    ? 'canva'
    : kind === 'large'
      ? 'shutterstock'
      : pickTarget(megapixels);
  const outFormat: UpscaleRecommendation['format'] = transparentSource ? 'png' : 'jpg';
  const chosenModel = model(chosen);
  const bestModel = model(best);

  const reason = bestReady
    ? `${bestModel.name} for this ${kind === 'art' ? 'artwork' : kind === 'transparent' ? 'cutout' : 'photo'} at ${megapixels.toFixed(1)} MP.`
    : `${chosenModel.name} now. ${bestModel.name} adds more detail once installed.`;

  return {
    modelId: chosen,
    bestModelId: best,
    targetId,
    reason,
    readyNow: bestReady,
    needsDownload: !bestReady && model(best).family !== 'builtin' && isDesktop,
    kind,
    format: outFormat,
  };
}

/** True when a recommendation differs from the current model choice. */
export function recommendationDiffers(currentModelId: string, recommendation: UpscaleRecommendation): boolean {
  return currentModelId !== recommendation.modelId;
}
