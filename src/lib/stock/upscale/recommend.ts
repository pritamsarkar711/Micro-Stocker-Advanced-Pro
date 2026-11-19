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
import type { ImageInsight } from '@/lib/vision/analyse';

export interface UpscaleSample {
  width: number;
  height: number;
  bytes: number;
  hasAlpha?: boolean;
  filename?: string;
  format?: string;
  /** Measured pixels, when the caller has already decoded the image. */
  insight?: ImageInsight | null;
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
  kind: 'photo' | 'art' | 'transparent' | 'small' | 'large' | 'text' | 'portrait';
  /** Why the model was chosen, in the order the checks ran. */
  evidence: string[];
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
  const insight = sample.insight ?? null;
  const transparent = Boolean(sample.hasAlpha) || Boolean(insight?.hasTransparency);
  const art = insight
    ? insight.flatArt || ['illustration', 'pattern', 'abstract'].includes(insight.kind)
    : looksLikeArt(sample, bytesPerPixel);
  const ready = (id: string) => model(id).family === 'builtin' || Boolean(installed[id]);

  const notes: string[] = [];
  const evidence: string[] = [];
  let kind: UpscaleRecommendation['kind'] = 'photo';
  let modelId = 'lanczos-pro';
  let bestModelId = 'realesrgan-x4plus';

  const sharpness = insight?.quality.sharpness ?? null;
  const noise = insight?.quality.noise ?? 0;
  const textHeavy = Boolean(insight && (insight.kind === 'document' || insight.kind === 'screenshot' || insight.hasFineText));

  if (transparent) {
    kind = 'transparent';
    modelId = 'edge-crisp';
    bestModelId = 'edge-crisp';
    notes.push('Transparency stays intact.');
    evidence.push('Alpha channel detected');
  } else if (textHeavy) {
    // Generative models hallucinate glyphs; an edge aware resampler keeps text legible.
    kind = 'text';
    modelId = 'lanczos-pro';
    bestModelId = 'edge-crisp';
    notes.push('Text and thin lines stay legible.');
    evidence.push('Text or interface layout detected');
  } else if (art) {
    kind = 'art';
    modelId = 'edge-crisp';
    bestModelId = 'realesr-animevideov3';
    notes.push('Flat artwork keeps clean outlines.');
    evidence.push('Flat colour areas with few gradients');
  } else if (insight && noise > 13) {
    kind = 'photo';
    modelId = 'photo-restore';
    bestModelId = 'realesrgan-general-wdn';
    notes.push('Grain is cleaned before detail is added.');
    evidence.push(`Visible grain (${noise.toFixed(1)})`);
  } else if (insight && sharpness !== null && sharpness < 45) {
    kind = 'photo';
    modelId = 'photo-restore';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Soft focus recovered instead of magnified.');
    evidence.push(`Soft focus (${sharpness.toFixed(0)})`);
  } else if (insight && insight.kind === 'portrait') {
    kind = 'portrait';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Facial texture stays natural.');
    evidence.push('Portrait subject detected');
  } else if (bytesPerPixel < 0.18 && bytesPerPixel > 0) {
    kind = 'small';
    modelId = 'photo-restore';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Heavily compressed source, so light denoise comes first.');
    evidence.push('Low bits per pixel');
  } else if (insight && sharpness !== null && sharpness >= 200 && megapixels >= 8) {
    kind = 'large';
    modelId = 'lanczos-pro';
    bestModelId = 'lanczos-pro';
    notes.push('Already crisp. A faithful resize keeps it honest.');
    evidence.push(`Sharp source (${sharpness.toFixed(0)}) at ${megapixels.toFixed(1)} MP`);
  } else if (megapixels < 1 || longEdge < 1400) {
    kind = 'small';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Small source: a detail model adds the most.');
    evidence.push(`Only ${megapixels.toFixed(1)} MP`);
  } else if (megapixels >= 24) {
    kind = 'large';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrnet-x4plus';
    notes.push('Already stock sized, so a faithful pass is enough.');
    evidence.push(`${megapixels.toFixed(0)} MP source`);
  } else {
    kind = 'photo';
    modelId = 'lanczos-pro';
    bestModelId = 'realesrgan-x4plus';
    notes.push('Photo detail without invented texture.');
  }

  if (insight?.quality.highlightClip && insight.quality.highlightClip > 0.02) {
    evidence.push('Clipped highlights');
  }
  if (insight?.quality.shadowClip && insight.quality.shadowClip > 0.03) {
    evidence.push('Crushed shadows');
  }

  // The best model may not be usable yet. Never preselect something the user
  // cannot run: fall back to the strongest ready option.
  let chosen = modelId;
  // The single graph mobile model is a real detail pass, so once it is installed
  // it is the right pick for photo-like sources that would otherwise fall back to
  // a plain resampler. Text, art and cutouts keep their dedicated engines.
  const mobileNeural = 'realesr-general-x4v3';
  const photoLike = kind === 'photo' || kind === 'small' || kind === 'portrait';
  if (photoLike && ready(mobileNeural)) chosen = mobileNeural;
  if (!ready(chosen)) {
    const fallback = ['edge-crisp', 'lanczos-pro', 'photo-restore', 'anime4k-shader'].find((id) => ready(id));
    chosen = fallback ?? 'lanczos-pro';
  }
  const best = bestModelId;
  const bestReady = ready(best);
  const transparentSource = kind === 'transparent';
  const targetId = transparentSource ? 'canva' : pickTarget(megapixels);
  const outFormat: UpscaleRecommendation['format'] = transparentSource
    ? 'png'
    : kind === 'text'
      ? 'png'
      : 'jpg';
  const chosenModel = model(chosen);
  const bestModel = model(best);

  const subject =
    kind === 'art' ? 'artwork' : kind === 'transparent' ? 'cutout' : kind === 'text' ? 'text layout' : kind === 'portrait' ? 'portrait' : 'photo';
  const reason = bestReady
    ? `${bestModel.name} for this ${subject} at ${megapixels.toFixed(1)} MP. ${notes[0] ?? ''}`.trim()
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
    evidence: evidence.slice(0, 3),
  };
}

/** True when a recommendation differs from the current model choice. */
export function recommendationDiffers(currentModelId: string, recommendation: UpscaleRecommendation): boolean {
  return currentModelId !== recommendation.modelId;
}
