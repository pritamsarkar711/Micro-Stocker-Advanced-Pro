import { appName } from '@/lib/version';
import { kv } from '@/lib/kv';
import { analyseBlob } from '@/lib/vision';
import type { ImageInsight } from '@/lib/vision';
import { httpRequest } from '@/lib/desktop';
import type { BrandId } from '@/components/ui/BrandLogo';
import type { StockItem, StockMetadata } from './types';
import {
  cleanStockSentence,
  draftMetadata,
  scrubStockKeywords,
} from './metadata';

/**
 * Verified multi provider AI metadata engine (November 2026 catalog).
 *
 * Model presets below were verified on 17 November 2026 against
 *   · openrouter.ai/models?max_price=0   (free variants, pricing $0)
 *   · ai.google.dev/gemini-api/docs/pricing (Free tier ≠ "Not available")
 *   · console.groq.com/docs/models      (developer plan = free, rate limited)
 * Anything that moved to a paid-only tier was removed rather than left to fail
 * with a 402 at generation time. Live discovery still refreshes each list when a
 * key is present, so newly released free models appear without an update.
 *
 * Every provider uses only active, genuinely free models, supports
 * multimodal image vision wherever the model accepts images, strips reasoning
 * tags cleanly, fetches live free models from each provider API, and routes
 * requests through Electron's CORS free IPC bridge on desktop or fetch in the browser.
 */

export type ProviderKind = 'openrouter' | 'gemini' | 'groq' | 'nvidia' | 'custom';

export interface ModelPreset {
  id: string;
  label: string;
  brand: BrandId;
  vision?: boolean;
  free?: boolean;
}

export interface ProviderPreset {
  kind: ProviderKind;
  name: string;
  brand: BrandId;
  protocol: 'openai' | 'gemini';
  baseUrl: string;
  needsKey: boolean;
  optionalKey?: boolean;
  keyUrl?: string;
  badge: string;
  models: ModelPreset[];
}

export const PROVIDERS: Record<ProviderKind, ProviderPreset> = {
  openrouter: {
    kind: 'openrouter',
    name: 'OpenRouter',
    brand: 'openrouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
    badge: 'Free router',
    models: [
      { id: 'openrouter/free', label: 'OpenRouter Free Auto (Vision)', brand: 'openrouter', vision: true, free: true },
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B Instruct (Free)', brand: 'gemma', vision: true, free: true },
      { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B MoE (Free)', brand: 'gemma', vision: true, free: true },
      { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'Nemotron 3.5 Super VL (Free)', brand: 'nvidia', vision: true, free: true },
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 3 Nano Omni 30B (Free)', brand: 'nvidia', vision: true, free: true },
      { id: 'inclusionai/ling-3.2-flash:free', label: 'Ling 3.2 Flash (Free)', brand: 'openrouter', vision: true, free: true },
      { id: 'thinkingmachines/inkling-2-small:free', label: 'Inkling 2 Small (Free)', brand: 'openrouter', vision: true, free: true },
      { id: 'dots-studio/dots-3-note-preview:free', label: 'Dots3 Note Preview (Free)', brand: 'openrouter', vision: true, free: true },
      { id: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning (Free)', brand: 'nvidia', free: true },
    ],
  },

  gemini: {
    kind: 'gemini',
    name: 'Google Gemini',
    brand: 'gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    badge: 'Free tier',
    models: [
      { id: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash (Vision)', brand: 'gemini', vision: true, free: true },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Vision)', brand: 'gemini', vision: true, free: true },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Vision)', brand: 'gemini', vision: true, free: true },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Vision)', brand: 'gemini', vision: true, free: true },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Vision)', brand: 'gemini', vision: true, free: true },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Vision)', brand: 'gemini', vision: true, free: true },
    ],
  },

  groq: {
    kind: 'groq',
    name: 'Groq',
    brand: 'groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    badge: 'Rate-limited',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', brand: 'openai', free: true },
      { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B Fast', brand: 'openai', free: true },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', brand: 'qwen', free: true },
    ],
  },

  nvidia: {
    kind: 'nvidia',
    name: 'NVIDIA NIM',
    brand: 'nvidia',
    protocol: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    needsKey: true,
    keyUrl: 'https://build.nvidia.com',
    badge: 'Free tier',
    models: [
      { id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B Vision', brand: 'meta', vision: true, free: true },
      { id: 'qwen/qwen2.5-vl-72b-instruct', label: 'Qwen 2.5 VL 72B Vision', brand: 'qwen', vision: true, free: true },
      { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', brand: 'meta', free: true },
      { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Nemotron Ultra 253B', brand: 'nvidia', free: true },
      { id: 'deepseek-ai/deepseek-v3.2', label: 'DeepSeek V3.2', brand: 'deepseek', free: true },
      { id: 'mistralai/mistral-small-3.1-24b-instruct-2503', label: 'Mistral Small 3.1 24B (Vision)', brand: 'mistral', vision: true, free: true },
    ],
  },

  custom: {
    kind: 'custom',
    name: 'Custom Endpoint',
    brand: 'custom',
    protocol: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false,
    optionalKey: true,
    badge: 'OpenAI API',
    models: [],
  },
};

export const PROVIDER_LIST: ProviderPreset[] = Object.values(PROVIDERS);

export interface AiSettings {
  kind: ProviderKind;
  model: string;
  baseUrl: string;
  keys: Partial<Record<ProviderKind, string>>;
  modelsByProvider?: Partial<Record<ProviderKind, string>>;
  targetKeywords: number;
  tone: 'commercial' | 'editorial' | 'minimal';
  useVision: boolean;
  autoEmbed: boolean;
}

export const DEFAULT_AI: AiSettings = {
  kind: 'openrouter',
  model: 'openrouter/free',
  baseUrl: '',
  keys: {},
  modelsByProvider: {},
  targetKeywords: 35,
  tone: 'commercial',
  useVision: true,
  autoEmbed: true,
};

const STORAGE_KEY = 'msap:ai';

/** Upgrade any stale model IDs stored from older versions to verified active models. */
const RETIRED_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'llama-3.3-70b-versatile': 'qwen/qwen3.8-27b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'qwen/qwen3-32b': 'qwen/qwen3.8-27b',
  'qwen/qwen-2.5-72b-instruct:free': 'openrouter/free',
  'deepseek/deepseek-chat-v3-0324:free': 'openrouter/free',
  'google/gemini-2.0-flash-exp:free': 'google/gemma-4-31b-it:free',
};

export function sanitizeAiSettings(raw: Partial<AiSettings> | null | undefined): AiSettings {
  const kind: ProviderKind = raw?.kind && PROVIDERS[raw.kind] ? raw.kind : DEFAULT_AI.kind;
  const preset = PROVIDERS[kind];
  let model = (raw?.model ?? '').trim();
  if (RETIRED_MODEL_MAP[model]) model = RETIRED_MODEL_MAP[model];
  if (!model && preset.models[0]) model = preset.models[0].id;
  return {
    ...DEFAULT_AI,
    ...raw,
    kind,
    model,
    baseUrl: raw?.baseUrl ?? (kind === 'custom' ? preset.baseUrl : ''),
    keys: raw?.keys ?? {},
    modelsByProvider: raw?.modelsByProvider ?? {},
    targetKeywords: Math.min(49, Math.max(7, Number(raw?.targetKeywords) || 35)),
    tone: raw?.tone === 'editorial' || raw?.tone === 'minimal' ? raw.tone : 'commercial',
    useVision: raw?.useVision !== false,
    autoEmbed: raw?.autoEmbed !== false,
  };
}

export const loadAiSettings = async (): Promise<AiSettings> =>
  sanitizeAiSettings(await kv.get<Partial<AiSettings>>(STORAGE_KEY, DEFAULT_AI));

export const saveAiSettings = (settings: AiSettings): Promise<boolean> =>
  kv.set(STORAGE_KEY, sanitizeAiSettings(settings));

export function isAiConfigured(settings: AiSettings): boolean {
  const preset = PROVIDERS[settings.kind];
  if (!preset) return false;
  if (settings.kind === 'custom') return Boolean(settings.baseUrl.trim() && settings.model.trim());
  if (preset.needsKey && !settings.keys[settings.kind]?.trim()) return false;
  return Boolean(settings.model.trim());
}

export function normalizeOpenAiBase(raw: string, fallback: string): string {
  let url = (raw.trim() || fallback).replace(/\/+$/, '');
  url = url.replace(/\/chat\/completions$/i, '');
  return url;
}

export function inferModelBrand(modelId: string, fallback: BrandId): BrandId {
  const s = modelId.toLowerCase();
  if (s.includes('gemma')) return 'gemma';
  if (s.includes('gemini')) return 'gemini';
  if (s.includes('llama') || s.startsWith('meta/') || s.startsWith('meta-llama/')) return 'meta';
  if (s.includes('qwen') || s.includes('qwq')) return 'qwen';
  if (s.includes('deepseek')) return 'deepseek';
  if (s.includes('mistral') || s.includes('ministral') || s.includes('pixtral') || s.includes('codestral')) return 'mistral';
  if (s.includes('nemotron') || s.startsWith('nvidia/')) return 'nvidia';
  if (s.includes('phi')) return 'microsoft';
  if (s.includes('gpt-oss') || s.startsWith('openai/')) return 'openai';
  if (s.includes('command') || s.includes('cohere') || s.includes('north')) return 'cohere';
  if (s.includes('liquid') || s.includes('lfm')) return 'liquid';
  if (s.includes('glm') || s.includes('zai')) return 'zhipu';
  if (s.includes('kimi') || s.includes('moonshot')) return 'moonshot';
  if (s.includes('minimax')) return 'minimax';
  if (s.includes('step')) return 'stepfun';
  if (s.includes('claude')) return 'anthropic';
  if (s.includes('grok')) return 'xai';
  if (s.startsWith('openrouter/')) return 'openrouter';
  if (s.startsWith('groq/')) return 'groq';
  return fallback;
}

export function modelSupportsVision(kind: ProviderKind, modelId: string, dynamicList?: ModelPreset[]): boolean {
  const known = [...(dynamicList ?? []), ...(PROVIDERS[kind]?.models ?? [])].find((m) => m.id === modelId);
  if (known && known.vision !== undefined) return Boolean(known.vision);
  const s = modelId.toLowerCase();
  return (
    kind === 'gemini' ||
    s === 'openrouter/free' ||
    s.includes('vision') ||
    s.includes('-vl') ||
    s.includes('vl:') ||
    s.includes('llava') ||
    s.includes('pixtral') ||
    s.includes('gemma-4') ||
    s.includes('gemma4') ||
    s.includes('gemma-3') ||
    s.includes('omni') ||
    s.includes('qwen3.8') ||
    s.includes('qwen2.5-vl') ||
    s.includes('mistral-small-3') ||
    s.includes('mistral-small-latest')
  );
}

export interface VisionPayload {
  mimeType: string;
  base64: string;
  dataUrl: string;
}

/** Downscale an image Blob to a compact JPEG payload suited for vision APIs. */
export async function blobToVisionPayload(blob?: Blob | null, maxEdge = 768): Promise<VisionPayload | null> {
  if (!blob || !blob.type.startsWith('image/')) return null;
  if (typeof createImageBitmap !== 'function') return null;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height, 1));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    return {
      mimeType: 'image/jpeg',
      base64: dataUrl.slice(comma + 1),
      dataUrl,
    };
  } catch {
    return null;
  } finally {
    bmp?.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Prompt builder & resilient JSON parser                                     */
/* -------------------------------------------------------------------------- */

function buildPrompt(
  item: Pick<StockItem, 'name' | 'format' | 'width' | 'height' | 'flags' | 'metadata'>,
  settings: AiSettings,
  hasImage: boolean,
  insight?: ImageInsight | null,
): string {
  const toneGuide =
    settings.tone === 'editorial'
      ? 'Write factual journalistic metadata describing visible subjects and context.'
      : settings.tone === 'minimal'
        ? 'Write crisp, understated metadata highlighting composition, color and copy space.'
        : 'Write clear, descriptive commercial metadata suited to any stock marketplace.';

  const dims = item.width && item.height ? `${item.width}x${item.height} px` : 'standard resolution';
  const kind =
    item.format === 'eps' || item.format === 'ai' || item.format === 'svg'
      ? 'vector graphic'
      : item.flags.illustration
        ? 'digital illustration'
        : 'photograph';
  const measured = insight
    ? [
        `Local measurements (reliable, from the pixels): scene guess ${insight.kind}, orientation ${insight.orientation}, ` +
          `${(insight.palette.slice(0, 3).map((colour) => colour.name).join(', ') || 'neutral')} palette, ` +
          `${insight.quality.sharpnessLabel} focus, ${insight.quality.noiseLabel}` +
          (insight.hasTransparency ? ', transparent background' : '') +
          (insight.uniformBackground ? `, uniform ${insight.backgroundHex ?? ''} background` : '') +
          '.',
        'Treat these measurements as ground truth where they describe the file, but trust the image itself for the subject.',
      ].join('\n')
    : '';
  const hints = [
    item.metadata.title ? `Current title hint: ${item.metadata.title}` : '',
    item.metadata.keywords.length ? `Seed tags: ${item.metadata.keywords.slice(0, 10).join(', ')}` : '',
    measured,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    toneGuide,
    hasImage
      ? 'Carefully examine the attached image and describe its true subject, setting, colors, lighting, mood and composition.'
      : 'Infer the commercial subject and visual qualities from the file details below.',
    'Strict marketplace rules:',
    '1. title: 5 to 12 descriptive English words, maximum 70 characters, no commas, no dashes, no quotes, no camera terms, no brand trademarks, no artist names, no AI prompt words.',
    '2. description: one natural sentence of 12 to 28 words, maximum 195 characters, no dashes, adding helpful context beyond the title.',
    `3. keywords: array of exactly ${settings.targetKeywords} unique lowercase English terms (1 to 3 words each) ordered from highest search relevance to broader concepts. Put the 10 strongest literal buyer keywords first and include key title words. Never include trademarks, brands or AI generator names.`,
    '4. categories: array of 1 or 2 broad stock categories such as Nature, Business/Finance, Food and drink, Technology, People, Travel, Interiors, Buildings/Landmarks, Objects, Abstract, Backgrounds/Textures, Healthcare/Medical, Animals/Wildlife, Education, Holidays, Signs/Symbols.',
    'Respond with ONLY a single valid JSON object in this exact shape: {"title":"...","description":"...","keywords":["..."],"categories":["..."]}',
    '',
    `Filename: ${item.name}`,
    `Asset type: ${kind} (${item.format.toUpperCase()}, ${dims})`,
    hints,
  ]
    .filter(Boolean)
    .join('\n');
}

export function extractJsonMetadata(raw: string, fallback: StockMetadata, targetCount = 49): StockMetadata {
  // Strip <think>...</think> reasoning blocks and code fences before locating JSON.
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Provider response did not include valid JSON metadata.');
  }

  const candidate = stripped
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, '$1');

  let parsed: {
    title?: unknown;
    description?: unknown;
    keywords?: unknown;
    tags?: unknown;
    categories?: unknown;
    category?: unknown;
  };
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('Could not parse JSON returned by the AI model.');
  }

  const rawTitle = typeof parsed.title === 'string' ? parsed.title : fallback.title;
  // Marketplaces cap titles hard (Shutterstock at 200 characters, Adobe at 70
  // characters per line), and a rambling title loses buyer trust.
  let title = cleanStockSentence(rawTitle, 70, true) || fallback.title;
  if (title.split(/\s+/).filter(Boolean).length < 5) title = fallback.title;

  const rawDesc = typeof parsed.description === 'string' ? parsed.description : fallback.description;
  let description = cleanStockSentence(rawDesc, 195, false) || fallback.description;
  if (description.split(/\s+/).filter(Boolean).length < 8 || description.toLowerCase() === title.toLowerCase()) {
    description = fallback.description;
  }

  const kwSource = parsed.keywords ?? parsed.tags;
  const rawKeywords = Array.isArray(kwSource)
    ? kwSource.map((k) => String(k))
    : typeof kwSource === 'string'
      ? kwSource.split(/[,;\n]+/)
      : [];
  // Keywords must be searchable: 1 to 3 words, no bare numbers, no duplicates.
  const cleaned = rawKeywords
    .map((word) => String(word).trim())
    .filter((word) => word && word.split(/\s+/).length <= 3 && !/^\d+$/.test(word))
    .map((word) => word.toLowerCase());
  const titleWords = new Set(title.toLowerCase().split(/\s+/).filter((word) => word.length > 3));
  const ranked = [...new Set(cleaned)].sort((left, right) => {
    const leftHit = titleWords.has(left) ? 1 : 0;
    const rightHit = titleWords.has(right) ? 1 : 0;
    return rightHit - leftHit;
  });
  const keywords = scrubStockKeywords(ranked, Math.min(49, Math.max(7, targetCount)));

  const catSource = parsed.categories ?? parsed.category;
  const rawCats = Array.isArray(catSource)
    ? catSource.map((c) => String(c).trim()).filter(Boolean)
    : typeof catSource === 'string' && catSource.trim()
      ? [catSource.trim()]
      : fallback.categories;

  return {
    title,
    description,
    keywords: keywords.length >= 5 ? keywords : scrubStockKeywords([...keywords, ...fallback.keywords], targetCount),
    categories: rawCats.slice(0, 2),
  };
}

function parseApiError(status: number, text: string, providerName: string): string {
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const msg =
      typeof parsed.error === 'string'
        ? parsed.error
        : parsed.error?.message || parsed.message || text.slice(0, 220);
    return `${providerName} (${status}): ${msg.replace(/[-–—]+/g, ' ').trim()}`;
  } catch {
    return `${providerName} error ${status}: ${(text || 'Empty response').slice(0, 200)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Provider transport implementations                                         */
/* -------------------------------------------------------------------------- */

async function callOpenAiProtocol(
  settings: AiSettings,
  prompt: string,
  vision: VisionPayload | null,
  overrideModel?: string,
): Promise<string> {
  const preset = PROVIDERS[settings.kind];
  const base = normalizeOpenAiBase(settings.baseUrl, preset.baseUrl);
  const key = settings.keys[settings.kind]?.trim();
  const model = (overrideModel || settings.model).trim();

  if (preset.needsKey && !key) {
    throw new Error(`Enter your ${preset.name} API key in AI settings.`);
  }
  if (!model) {
    throw new Error(`Select or enter a model for ${preset.name}.`);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (settings.kind === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro';
    headers['X-Title'] = appName();
  }

  const postOnce = async (withJsonFormat: boolean, withVision: boolean) => {
    const userContent =
      withVision && vision
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: vision.dataUrl } },
          ]
        : prompt;

    const payload: Record<string, unknown> = {
      model,
      temperature: 0.35,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content: 'You are an expert commercial microstock metadata specialist. Return strictly valid JSON only.',
        },
        { role: 'user', content: userContent },
      ],
    };
    if (withJsonFormat) {
      payload.response_format = { type: 'json_object' };
    }

    return httpRequest({
      url: `${base}/chat/completions`,
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs: 65000,
    });
  };

  // Avoid forcing response_format on OpenRouter free models and Gemma/DeepSeek R1 models that reject it.
  const prefersPlainJson =
    settings.kind === 'openrouter' ||
    settings.kind === 'custom' ||
    settings.kind === 'nvidia' ||
    /gemma|deepseek-r1|compound|lfm/i.test(model);

  let res = await postOnce(!prefersPlainJson, Boolean(vision));

  // If the chosen model rejects image_url, retry text only automatically.
  if (!res.ok && vision && (res.status === 400 || res.status === 404 || res.status === 422)) {
    const errText = (res.text || '').toLowerCase();
    if (/image|vision|multimodal|content.*array|unsupported/i.test(errText)) {
      res = await postOnce(false, false);
    }
  }

  // If the chosen model rejects response_format json_object, retry without it.
  if (!res.ok && !prefersPlainJson && (res.status === 400 || res.status === 422)) {
    res = await postOnce(false, Boolean(vision));
  }

  // Automatic OpenRouter free fallback when an individual :free endpoint is rate limited or rotated.
  if (
    !res.ok &&
    settings.kind === 'openrouter' &&
    model !== 'openrouter/free' &&
    (res.status === 404 || res.status === 429 || res.status === 502 || res.status === 503)
  ) {
    return callOpenAiProtocol(settings, prompt, vision, 'openrouter/free');
  }

  if (!res.ok) {
    if (res.status === 0) {
      throw new Error(`Could not connect to ${preset.name}: ${res.error || 'network unreachable'}`);
    }
    throw new Error(parseApiError(res.status, res.text || '', preset.name));
  }

  const data = JSON.parse(res.text || '{}') as {
    choices?: Array<{
      message?: { content?: string | Array<{ type?: string; text?: string }> };
    }>;
  };
  const rawContent = data.choices?.[0]?.message?.content;
  const content = Array.isArray(rawContent)
    ? rawContent.map((part) => part.text ?? '').join('\n')
    : (rawContent ?? '');
  if (!content.trim()) {
    throw new Error(`${preset.name} returned an empty completion.`);
  }
  return content;
}

async function callGeminiProtocol(
  settings: AiSettings,
  prompt: string,
  vision: VisionPayload | null,
): Promise<string> {
  const key = settings.keys.gemini?.trim();
  if (!key) throw new Error('Enter your Google Gemini API key in AI settings.');
  const base = (settings.baseUrl.trim() || PROVIDERS.gemini.baseUrl).replace(/\/+$/, '');
  const model = (settings.model.trim() || 'gemini-2.5-flash').replace(/^models\//, '');
  const isGemma = /^gemma/i.test(model);

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (vision) {
    parts.push({
      inlineData: {
        mimeType: vision.mimeType,
        data: vision.base64,
      },
    });
  }

  const send = async (useJsonMime: boolean) => {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.35,
      maxOutputTokens: 2048,
    };
    if (useJsonMime) {
      generationConfig.responseMimeType = 'application/json';
    }
    const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    return httpRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
      timeoutMs: 65000,
    });
  };

  let res = await send(!isGemma);
  if (!res.ok && !isGemma && res.status === 400 && /mime|json|generation/i.test(res.text || '')) {
    res = await send(false);
  }

  if (!res.ok) {
    if (res.status === 0) {
      throw new Error(`Could not reach Google Gemini: ${res.error || 'network unreachable'}`);
    }
    throw new Error(parseApiError(res.status, res.text || '', 'Google Gemini'));
  }

  const data = JSON.parse(res.text || '{}') as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const outParts = data.candidates?.[0]?.content?.parts ?? [];
  const text = outParts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
    .trim();
  if (!text) {
    throw new Error('Google Gemini returned an empty response.');
  }
  return text;
}

/* -------------------------------------------------------------------------- */
/* Public generation, testing & live model discovery                         */
/* -------------------------------------------------------------------------- */

export async function generateAiMetadata(
  item: Pick<StockItem, 'name' | 'format' | 'width' | 'height' | 'flags' | 'metadata'>,
  settings: AiSettings,
  options?: { imageBlob?: Blob | null },
): Promise<StockMetadata> {
  const cleanSettings = sanitizeAiSettings(settings);

  const preset = PROVIDERS[cleanSettings.kind];
  const insight = await analyseBlob(options?.imageBlob);
  const fallback = draftMetadata(item, cleanSettings.targetKeywords, null, insight);
  const canSee =
    cleanSettings.useVision &&
    Boolean(options?.imageBlob) &&
    modelSupportsVision(cleanSettings.kind, cleanSettings.model);
  const vision = canSee ? await blobToVisionPayload(options?.imageBlob) : null;
  const prompt = buildPrompt(item, cleanSettings, Boolean(vision), insight);

  let raw: string;
  if (preset.protocol === 'gemini') {
    raw = await callGeminiProtocol(cleanSettings, prompt, vision);
  } else {
    raw = await callOpenAiProtocol(cleanSettings, prompt, vision);
  }

  return extractJsonMetadata(raw, fallback, cleanSettings.targetKeywords);
}

/** Verify end to end connectivity and JSON generation for the active provider. */
export async function testAiConnection(
  settings: AiSettings,
): Promise<{ ok: true; latencyMs: number; sampleTitle: string } | { ok: false; error: string }> {
  const started = performance.now();
  try {
    const sample = await generateAiMetadata(
      {
        name: 'morning_coffee_cup_wooden_desk.jpg',
        format: 'jpg',
        width: 6000,
        height: 4000,
        flags: {
          aiGenerated: false,
          aiTool: '',
          editorial: false,
          mature: false,
          illustration: false,
          license: 'free',
        },
        metadata: { title: '', description: '', keywords: [], categories: [] },
      },
      { ...settings, targetKeywords: 12, useVision: false },
    );
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    return { ok: true, latencyMs, sampleTitle: sample.title };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Discover currently live free or local models directly from the provider API. */
export async function syncProviderModels(
  settings: AiSettings,
): Promise<{ ok: true; models: ModelPreset[] } | { ok: false; error: string }> {
  const preset = PROVIDERS[settings.kind];

  try {
    if (settings.kind === 'openrouter') {
      const res = await httpRequest({ url: 'https://openrouter.ai/api/v1/models', timeoutMs: 20000 });
      if (!res.ok) return { ok: false, error: `OpenRouter returned ${res.status}.` };
      const parsed = JSON.parse(res.text || '{}') as {
        data?: Array<{
          id?: string;
          name?: string;
          pricing?: { prompt?: string; completion?: string };
          architecture?: { input_modalities?: string[]; modality?: string };
        }>;
      };
      const freeList: ModelPreset[] = [
        { id: 'openrouter/free', label: 'OpenRouter Free Auto (Vision)', brand: 'openrouter', vision: true, free: true },
      ];
      for (const item of parsed.data ?? []) {
        const id = String(item.id ?? '').trim();
        if (!id || id === 'openrouter/free') continue;
        const promptCost = Number(item.pricing?.prompt ?? '1');
        const compCost = Number(item.pricing?.completion ?? '1');
        const isFree = id.endsWith(':free') || (promptCost === 0 && compCost === 0);
        if (!isFree) continue;
        const modalities = item.architecture?.input_modalities ?? [];
        const hasVision =
          modalities.includes('image') || Boolean(item.architecture?.modality?.includes('image'));
        const cleanLabel = String(item.name || id)
          .replace(/\(free\)/gi, '')
          .replace(/[-–—]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        freeList.push({
          id,
          label: hasVision ? `${cleanLabel} (Vision)` : cleanLabel,
          brand: inferModelBrand(id, 'openrouter'),
          vision: hasVision,
          free: true,
        });
      }
      return { ok: true, models: freeList };
    }

    if (settings.kind === 'gemini') {
      const key = settings.keys.gemini?.trim();
      if (!key) return { ok: false, error: 'Enter your Gemini API key first to load live models.' };
      const base = (settings.baseUrl.trim() || preset.baseUrl).replace(/\/+$/, '');
      const res = await httpRequest({
        url: `${base}/models?key=${encodeURIComponent(key)}`,
        timeoutMs: 15000,
      });
      if (!res.ok) return { ok: false, error: parseApiError(res.status, res.text || '', 'Gemini') };
      const parsed = JSON.parse(res.text || '{}') as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models: ModelPreset[] = [];
      for (const m of parsed.models ?? []) {
        if (!m.supportedGenerationMethods?.includes('generateContent')) continue;
        const id = String(m.name ?? '').replace(/^models\//, '');
        if (!id || /embedding|imagen|veo|tts|audio|aqa|1\.5|2\.0/i.test(id)) continue;
        if (!/flash|gemma/i.test(id)) continue;
        models.push({
          id,
          label: String(m.displayName || id).replace(/[-–—]+/g, ' '),
          brand: inferModelBrand(id, 'gemini'),
          vision: true,
          free: true,
        });
      }
      return { ok: true, models: models.length ? models : preset.models };
    }

    // Standard OpenAI /models discovery (Groq, Cerebras, Mistral, NVIDIA, Together, Custom)
    const base = normalizeOpenAiBase(settings.baseUrl, preset.baseUrl);
    const key = settings.keys[settings.kind]?.trim();
    if (preset.needsKey && !key) {
      return { ok: false, error: `Enter your ${preset.name} API key first.` };
    }
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await httpRequest({ url: `${base}/models`, headers, timeoutMs: 15000 });
    if (!res.ok) {
      return { ok: false, error: parseApiError(res.status, res.text || '', preset.name) };
    }
    const parsed = JSON.parse(res.text || '{}');
    const rawItems: Array<{ id?: string; display_name?: string; pricing?: { input?: number; output?: number } }> =
      Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];

    const models: ModelPreset[] = [];
    for (const item of rawItems) {
      const id = String(item.id ?? '').trim();
      if (!id) continue;
      if (/whisper|tts|embed|guard|moderation|rerank|playai|orpheus|dall-e|flux|sdxl/i.test(id)) {
        continue;
      }
      const vision = modelSupportsVision(settings.kind, id);
      models.push({
        id,
        label: item.display_name ? String(item.display_name).replace(/[-–—]+/g, ' ') : id,
        brand: inferModelBrand(id, preset.brand),
        vision,
        free: true,
      });
    }
    return { ok: true, models: models.length ? models : preset.models };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

