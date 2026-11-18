/**
 * One generation, start to finish.
 *
 * The edge function only chooses a brief (or renders a photo). Everything a
 * customer actually downloads is produced here from real geometry: paths,
 * fills and named groups, then a metadata block and a quality gate. If the gate
 * fails the job is retried with a different composition before the user is ever
 * shown a download button.
 */

import {
  artworkMetadata,
  artworkToSvgFile,
  artworkToSvg,
  artworkToVectorFile,
  renderArtwork,
  PALETTE_OPTIONS,
  STYLE_OPTIONS,
  type Artwork,
  type DesignSpec,
} from './engine';
import { checkArtwork, type QualityReport } from './quality';
import {
  buildImagePrompt,
  localBrief,
  sanitiseBrief,
  type GeneratorOptions,
  type ImageBrief,
  type ImageKind,
} from './brief';
import { licensingClient } from '@/lib/cloud/licensing';

export type GeneratorKind = 'eps' | 'svg' | 'ai' | 'jpg';

export interface RunInput {
  kind: GeneratorKind;
  prompt: string;
  options: GeneratorOptions;
  imageBrief?: ImageBrief;
  model?: string;
  trending?: string;
  signal?: AbortSignal;
}

export type Phase = 'briefing' | 'drawing' | 'checking' | 'saving' | 'done';

export interface ProgressEvent {
  phase: Phase;
  /** 0 to 1, for the bar. */
  progress: number;
  message: string;
  points: number;
}

export interface GeneratedArtifact {
  kind: GeneratorKind;
  spec?: DesignSpec;
  art?: Artwork;
  previewSvg?: string;
  metadata: { title: string; description: string; keywords: string[] };
  quality?: QualityReport;
  file?: { bytes: Uint8Array; mime: string; filename: string };
  imageUrl?: string;
  imagePrompt?: string;
  model: string;
  costUsd: number;
  generationId?: string;
  elapsedMs: number;
  attempts: number;
}

export class GenerationError extends Error {
  readonly code?: string;
  readonly detail?: string;
  constructor(message: string, code?: string, detail?: string) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
    this.detail = detail;
  }
}

const FRIENDLY: Record<string, string> = {
  'subscription required': 'An active subscription is required to generate files.',
  'insufficient credits': 'You are out of credits. Top up or upgrade your plan.',
  'daily limit reached': 'Daily generation limit reached. It resets every 24 hours.',
  'plan does not include vector': 'Your plan does not include the vector generators.',
  'plan does not include jpg': 'Your plan does not include the JPG studio.',
  'provider key not configured': 'The AI provider key is not configured yet. Ask an administrator to add it in the admin panel.',
  'provider disabled': 'That provider is disabled in the admin panel.',
  'model unavailable': 'That model is not available. Pick another one.',
  slow: 'Too many requests. Give it a few seconds and try again.',
};

function friendly(message: string): string {
  const key = Object.keys(FRIENDLY).find((candidate) => message.toLowerCase().includes(candidate));
  return key ? FRIENDLY[key] : message;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Estimates stay honest: a vector brief is fast, a photo render is not. */
export function estimateMs(kind: GeneratorKind): number {
  return kind === 'jpg' ? 22_000 : 6_000;
}

async function requestBrief(input: RunInput, seed: number): Promise<{ spec: DesignSpec; model: string; generationId?: string; costUsd: number }> {
  const client = licensingClient();
  const localMode = (import.meta.env.VITE_GENERATE_LOCAL as string | undefined) === '1';
  if (!client || localMode) {
    return { spec: localBrief(input.prompt, input.options, seed), model: 'local', costUsd: 0 };
  }

  const { data, error } = await client.functions.invoke('ai-generate', {
    body: {
      kind: input.kind,
      prompt: input.prompt,
      model: input.model,
      trending: input.trending,
      options: input.options,
    },
  });

  if (error) {
    const detail = typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : error.message;
    throw new GenerationError(friendly(detail || error.message), error.message, detail);
  }
  const payload = data as { spec?: unknown; model?: string; generation_id?: string; cost_usd?: number; error?: string };
  if (payload?.error) throw new GenerationError(friendly(payload.error), payload.error);
  if (!payload?.spec) throw new GenerationError('The provider did not return a design brief. Nothing was charged.');

  return {
    spec: sanitiseBrief(payload.spec, input.prompt, input.options, seed),
    model: payload.model ?? 'unknown',
    generationId: payload.generation_id,
    costUsd: payload.cost_usd ?? 0,
  };
}

async function attachQuality(generationId: string | undefined, quality: QualityReport, metadata: { title: string; description: string; keywords: string[] }, file: { filename: string; bytes: Uint8Array } | undefined) {
  if (!generationId) return;
  const client = licensingClient();
  if (!client) return;
  await client.rpc('pro_attach_quality', {
    p_id: generationId,
    p_quality: quality,
    p_metadata: metadata,
    p_file_name: file?.filename ?? null,
    p_file_bytes: file?.bytes.length ?? null,
  });
}

export async function generateArtwork(input: RunInput, onProgress: (event: ProgressEvent) => void): Promise<GeneratedArtifact> {
  const startedAt = performance.now();
  const seed = hash32(`${input.prompt}:${input.options.paletteId}:${input.options.layout}`);
  onProgress({ phase: 'briefing', progress: 0.05, message: 'Reading the brief', points: 0 });

  const brief = await requestBrief(input, seed);
  input.signal?.throwIfAborted();

  onProgress({ phase: 'drawing', progress: 0.35, message: 'Building paths', points: 1 });

  // Two attempts at most: an answer that fails the gate is replaced by a
  // composition we know passes instead of being shipped with a broken label.
  const attemptsPlan: DesignSpec[] = [brief.spec];
  attemptsPlan.push({ ...localBrief(input.prompt, input.options, seed + 17), layout: 'centered', style: input.options.auto ? 'flat' : brief.spec.style });
  attemptsPlan.push({ ...localBrief(input.prompt, input.options, seed + 29), layout: 'badge', style: input.options.auto ? 'icon' : brief.spec.style });

  let best: { art: Artwork; spec: DesignSpec; quality: QualityReport; metadata: { title: string; description: string; keywords: string[] }; text: string } | null = null;
  let attempts = 0;

  for (const spec of attemptsPlan) {
    attempts += 1;
    const art = renderArtwork(spec);
    const metadata = artworkMetadata(art, seed);
    const text = artworkToSvg(art, metadata);
    const quality = checkArtwork(art, metadata, input.kind === 'jpg' ? 'svg' : input.kind, input.kind === 'svg' ? text : undefined);
    if (!best || quality.score > best.quality.score) best = { art, spec, quality, metadata, text };
    if (quality.pass) break;
    onProgress({ phase: 'checking', progress: 0.55 + attempts * 0.08, message: 'Quality check failed, redrawing', points: 1 });
  }

  if (!best) throw new GenerationError('The generator could not produce a usable file.');
  if (!best.quality.pass) {
    await attachQuality(brief.generationId, best.quality, best.metadata, undefined);
    const failed = best.quality.checks.filter((check) => check.required && check.status === 'fail').map((check) => check.label);
    throw new GenerationError(
      'The quality check rejected this artwork, so nothing was delivered and the credit was returned.',
      'quality',
      failed.join(', '),
    );
  }

  onProgress({ phase: 'saving', progress: 0.82, message: 'Writing the file', points: 1 });
  const file =
    input.kind === 'svg'
      ? artworkToSvgFile(best.art, best.metadata)
      : artworkToVectorFile(best.art, input.kind === 'ai' ? 'ai' : 'eps', best.metadata);

  await attachQuality(brief.generationId, best.quality, best.metadata, file);

  onProgress({ phase: 'done', progress: 1, message: 'Ready to download', points: 1 });

  return {
    kind: input.kind,
    spec: best.spec,
    art: best.art,
    previewSvg: best.text,
    metadata: best.metadata,
    quality: best.quality,
    file,
    model: brief.model,
    costUsd: brief.costUsd,
    generationId: brief.generationId,
    elapsedMs: Math.round(performance.now() - startedAt),
    attempts,
  };
}

/* ------------------------------------------------------------------- JPG */

const JPG_KEYWORDS: Record<ImageKind, string[]> = {
  photo: ['photograph', 'natural light', 'commercial use', 'high resolution', 'stock photo'],
  illustration: ['illustration', 'digital art', 'commercial illustration', 'vector style', 'editorial'],
  stock: ['stock image', 'copy space', 'concept', 'business', 'background'],
  product: ['product photography', 'studio lighting', 'packaging', 'mockup', 'commerce'],
  lifestyle: ['lifestyle', 'people', 'wellbeing', 'home', 'connection'],
  food: ['food photography', 'fresh', 'recipe', 'kitchen', 'gourmet'],
  business: ['business', 'office', 'teamwork', 'corporate', 'meeting'],
  abstract: ['abstract', 'gradient', 'texture', 'background', 'modern'],
};

export function imageMetadata(brief: ImageBrief): { title: string; description: string; keywords: string[] } {
  const subject = brief.prompt.replace(/\s+/g, ' ').trim();
  const title = subject.charAt(0).toUpperCase() + subject.slice(1);
  const cleanTitle = title.length > 70 ? `${title.slice(0, 67).trimEnd()}...` : title;
  const description =
    `${cleanTitle}. ${brief.lighting} with a ${brief.mood} mood, prepared for commercial licensing. ` +
    'High resolution, no text or watermark.';
  const words = subject
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12);
  const keywords = Array.from(new Set([...words, ...JPG_KEYWORDS[brief.kind], 'commercial', 'premium', 'royalty free', 'ai assisted'])).slice(0, 40);
  return { title: cleanTitle, description: description.slice(0, 195), keywords };
}

export async function generateImage(input: RunInput, onProgress: (event: ProgressEvent) => void): Promise<GeneratedArtifact> {
  const startedAt = performance.now();
  const brief = input.imageBrief;
  if (!brief) throw new GenerationError('Choose an image type first.');
  const prompt = buildImagePrompt({ ...brief, prompt: input.prompt });

  onProgress({ phase: 'briefing', progress: 0.08, message: 'Sending the brief', points: 0 });

  const client = licensingClient();
  if (!client) throw new GenerationError('Connect the cloud project to use the JPG studio.');

  const { data, error } = await client.functions.invoke('ai-generate', {
    body: { kind: 'jpg', prompt, model: input.model ?? 'gpt-image-1', options: { size: sizeFor(brief.aspect) } },
  });
  if (error) {
    const detail = typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : error.message;
    throw new GenerationError(friendly(detail || error.message), error.message, detail);
  }
  const payload = data as { url?: string; model?: string; generation_id?: string; cost_usd?: number; error?: string };
  if (payload?.error || !payload?.url) throw new GenerationError(friendly(payload?.error ?? 'The image provider returned nothing.'));

  onProgress({ phase: 'saving', progress: 0.9, message: 'Storing the result', points: 1 });
  const response = await fetch(payload.url);
  if (!response.ok) throw new GenerationError('Could not read the finished image. It may have expired, try again.');
  const bytes = new Uint8Array(await response.arrayBuffer());

  const filename = `${input.prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'image'}.png`;
  onProgress({ phase: 'done', progress: 1, message: 'Ready to download', points: 1 });

  return {
    kind: 'jpg',
    metadata: imageMetadata(brief),
    file: { bytes, mime: 'image/png', filename },
    imageUrl: payload.url,
    imagePrompt: prompt,
    model: payload.model ?? 'gpt-image-1',
    costUsd: payload.cost_usd ?? 0,
    generationId: payload.generation_id,
    elapsedMs: Math.round(performance.now() - startedAt),
    attempts: 1,
  };
}

function sizeFor(aspect: string): string {
  switch (aspect) {
    case 'landscape':
      return '1536x1024';
    case 'portrait':
      return '1024x1536';
    case 'wide':
      return '1536x864';
    default:
      return '1024x1024';
  }
}

/* --------------------------------------------------------------- helpers */

export function styleLabel(id: string): string {
  return STYLE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function paletteLabel(id: string): string {
  return PALETTE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}
