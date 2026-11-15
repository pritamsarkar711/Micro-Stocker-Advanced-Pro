import { PLATFORMS, PLATFORM_LIST } from './platforms';
import type { PlatformId, StockItem, StockMetadata } from './types';

/**
 * Metadata generation backends.
 *
 * Everything here is free to the user: either a model running on their own
 * machine (Ollama, LM Studio, llama.cpp) or a hosted provider that offers a
 * free tier with the user's own API key. No paid subscription is required by
 * this application, and no key is ever sent anywhere except the provider the
 * user selected.
 */

export type AiProviderId =
  | 'offline'
  | 'ollama'
  | 'openrouter'
  | 'gemini'
  | 'mistral'
  | 'nvidia'
  | 'groq'
  | 'cerebras'
  | 'together'
  | 'openai-compatible';

export interface ProviderModel {
  id: string;
  label: string;
}

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Short tag shown in the UI: Local / Free tier / Custom. */
  kind: 'local' | 'cloud' | 'custom';
  /** Where the user gets a key. Empty for local providers. */
  keyUrl?: string;
  /** Default base URL (without a trailing slash). */
  baseUrl: string;
  /** true when the user may edit baseUrl (self-hosted, proxies). */
  editableBaseUrl?: boolean;
  /** Authentication header format. */
  auth: 'none' | 'bearer' | 'x-api-key' | 'query';
  /** Wire format. */
  api: 'openai' | 'gemini';
  models: ProviderModel[];
  /** Good default model. */
  defaultModel: string;
  /** Free-tier reality, shown once in the picker. */
  freeTierNote: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'offline',
    label: 'Built-in (no AI)',
    kind: 'local',
    baseUrl: '',
    auth: 'none',
    api: 'openai',
    models: [],
    defaultModel: '',
    freeTierNote: 'Filename + keyword bank only. Always available, no downloads.',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    kind: 'local',
    baseUrl: 'http://127.0.0.1:11434',
    editableBaseUrl: true,
    auth: 'none',
    api: 'openai',
    models: [
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B — light' },
      { id: 'llama3.1:8b', label: 'Llama 3.1 8B — balanced' },
      { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B — strong keywords' },
      { id: 'mistral:7b', label: 'Mistral 7B' },
      { id: 'gemma2:9b', label: 'Gemma 2 9B' },
      { id: 'phi3.5:3.8b', label: 'Phi 3.5 3.8B — fast on CPU' },
    ],
    defaultModel: 'llama3.1:8b',
    freeTierNote: 'Runs on your CPU or GPU. Free forever, fully offline.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'cloud',
    keyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
      { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (free)' },
      { id: 'mistralai/mistral-small-24b-instruct-2501:free', label: 'Mistral Small 24B (free)' },
      { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek Chat (free)' },
    ],
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    freeTierNote: 'Models tagged :free cost nothing (rate-limited).',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'cloud',
    keyUrl: 'https://aistudio.google.com/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: 'query',
    api: 'gemini',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    defaultModel: 'gemini-2.0-flash',
    freeTierNote: 'AI Studio keys include a free daily quota.',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    kind: 'cloud',
    keyUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'open-mistral-nemo', label: 'Mistral NeMo' },
      { id: 'mistral-large-latest', label: 'Mistral Large' },
    ],
    defaultModel: 'mistral-small-latest',
    freeTierNote: 'Experimentation tier is free with rate limits.',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    kind: 'cloud',
    keyUrl: 'https://build.nvidia.com',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
      { id: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B' },
      { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B' },
    ],
    defaultModel: 'meta/llama-3.1-70b-instruct',
    freeTierNote: 'Free developer credits on build.nvidia.com.',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'cloud',
    keyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B — fastest' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
    ],
    defaultModel: 'llama-3.1-8b-instant',
    freeTierNote: 'Generous free tier, very fast inference.',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    kind: 'cloud',
    keyUrl: 'https://cloud.cerebras.ai',
    baseUrl: 'https://api.cerebras.ai/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'llama3.1-8b', label: 'Llama 3.1 8B' },
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    ],
    defaultModel: 'llama3.1-8b',
    freeTierNote: 'Free tier for personal projects.',
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'cloud',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    baseUrl: 'https://api.together.xyz/v1',
    auth: 'bearer',
    api: 'openai',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Turbo' },
    ],
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    freeTierNote: 'Starter credits; free small models.',
  },
  {
    id: 'openai-compatible',
    label: 'Custom endpoint',
    kind: 'custom',
    baseUrl: 'http://127.0.0.1:1234/v1',
    editableBaseUrl: true,
    auth: 'bearer',
    api: 'openai',
    models: [],
    defaultModel: 'local-model',
    freeTierNote: 'Any OpenAI-compatible server: LM Studio, llama.cpp, vLLM.',
  },
];

export function getProvider(id: AiProviderId): AiProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export interface AiSettings {
  provider: AiProviderId;
  /** Override for self-hosted servers; empty = provider default. */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Optional creativity control, 0-1. */
  temperature: number;
}

export const EMPTY_AI_SETTINGS: AiSettings = {
  provider: 'offline',
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.6,
};

export function isAiReady(settings: AiSettings): boolean {
  const provider = getProvider(settings.provider);
  if (provider.id === 'offline') return false;
  if (provider.kind !== 'local' && !settings.apiKey.trim()) return false;
  return Boolean(settings.model.trim() || provider.defaultModel);
}

export function resolvedBaseUrl(settings: AiSettings): string {
  const provider = getProvider(settings.provider);
  return (settings.baseUrl.trim() || provider.baseUrl).replace(/\/$/, '');
}

export function resolvedModel(settings: AiSettings): string {
  const provider = getProvider(settings.provider);
  return settings.model.trim() || provider.defaultModel;
}

/* ------------------------------------------------------------------ */
/* Prompt                                                             */
/* ------------------------------------------------------------------ */

export const KEYWORD_FLOOR = 25;
export const KEYWORD_CEILING = 45;

function buildPrompt(item: StockItem, platform?: PlatformId): string {
  const spec = platform ? PLATFORMS[platform] : null;
  const maxTitle = spec ? Math.min(spec.title.maxChars, 195) : 195;
  const maxKw = spec ? spec.keywords.max : 49;
  const lines = [
    'You write metadata for microstock marketplaces.',
    'Reply with JSON only, no markdown, no commentary:',
    '{"title":"...","description":"...","keywords":["..."],"category":"..."}',
    '',
    `File name: ${item.name}`,
    `Type: ${item.format.toUpperCase()} ${item.flags.illustration ? '(illustration)' : '(photo/artwork)'}`,
    `Title: one natural English sentence, 8-18 words, under ${maxTitle} characters, no commas.`,
    `Description: one factual English sentence under 190 characters.`,
    `Keywords: ${KEYWORD_FLOOR}-${Math.min(KEYWORD_CEILING, maxKw)} single-word or short-phrase English terms, most important first, lowercase, no duplicates, no brand or celebrity names.`,
    `Category: one of ${SHUTTER_CATEGORY_NAMES.join(', ')}.`,
  ];
  if (item.flags.aiGenerated) lines.push('Note: this asset was produced with generative AI.');
  return lines.join('\n');
}

const SHUTTER_CATEGORY_NAMES = [
  'Abstract', 'Animals/Wildlife', 'Arts', 'Backgrounds/Textures', 'Beauty/Fashion',
  'Buildings/Landmarks', 'Business/Finance', 'Celebrities', 'Education', 'Food and Drink',
  'Healthcare/Medical', 'Holidays', 'Industrial', 'Interiors', 'Miscellaneous', 'Nature',
  'Objects', 'Parks/Outdoor', 'People', 'Religion', 'Science', 'Signs/Symbols',
  'Sports/Recreation', 'Technology', 'Transportation', 'Vintage',
];

function parseModelJson(raw: string): Partial<StockMetadata> & { category?: string } {
  // Models sometimes wrap JSON in fences or prose; grab the outermost object.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The model did not return JSON.');
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords
    : typeof parsed.keywords === 'string'
      ? String(parsed.keywords).split(',')
      : [];
  return {
    title: String(parsed.title ?? parsed.name ?? '').trim(),
    description: String(parsed.description ?? parsed.caption ?? '').trim(),
    keywords: keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean),
    categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
    category: typeof parsed.category === 'string' ? parsed.category : undefined,
  };
}

/** Clean, de-duplicate and cap generated metadata for a target platform. */
export function normalizeMetadata(
  raw: Partial<StockMetadata> & { category?: string },
  platform?: PlatformId,
): StockMetadata {
  const spec = platform ? PLATFORMS[platform] : null;
  const seen = new Set<string>();
  let keywords: string[] = [];
  const source = Array.isArray(raw.keywords) ? raw.keywords : [];
  for (const keyword of source) {
    const clean = keyword
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 3 || clean.length > 40) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    keywords.push(clean);
  }
  const kwMax = spec ? spec.keywords.max : 49;
  const kwMin = spec ? spec.keywords.min : 7;
  keywords = keywords.slice(0, kwMax);
  if (keywords.length < kwMin) keywords = keywords.slice(0, kwMax);

  const titleMax = spec ? Math.min(spec.title.maxChars, 200) : 200;
  let title = (raw.title ?? '').replace(/\s+/g, ' ').trim();
  if (spec?.title.noCommas) title = title.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  title = title.slice(0, titleMax);

  let description = (raw.description ?? '').replace(/\s+/g, ' ').trim();
  const descMax = spec ? Math.min(spec.description.maxChars, 500) : 500;
  description = description.slice(0, descMax);

  const categories = Array.isArray(raw.categories) && raw.categories.length
    ? raw.categories.slice(0, 2)
    : raw.category
      ? [raw.category].slice(0, 2)
      : [];

  return { title, description, keywords, categories };
}

/* ------------------------------------------------------------------ */
/* Transports                                                         */
/* ------------------------------------------------------------------ */

export interface GenerateArgs {
  item: StockItem;
  settings: AiSettings;
  platform?: PlatformId;
  signal?: AbortSignal;
}

interface OpenAiReply {
  choices?: { message?: { content?: string } }[];
}

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function requestOpenAi(args: GenerateArgs): Promise<string> {
  const { settings, item, platform, signal } = args;
  const provider = getProvider(settings.provider);
  const url = `${resolvedBaseUrl(settings)}/chat/completions`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (provider.auth === 'bearer' && settings.apiKey.trim()) {
    headers.authorization = `Bearer ${settings.apiKey.trim()}`;
  }
  if (provider.auth === 'x-api-key' && settings.apiKey.trim()) {
    headers['x-api-key'] = settings.apiKey.trim();
  }
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro';
    headers['X-Title'] = 'Micro Stocker Advanced Pro';
  }

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: resolvedModel(settings),
      temperature: settings.temperature,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: 'You are a precise microstock metadata writer. Answer with JSON only.',
        },
        { role: 'user', content: buildPrompt(item, platform) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(describeHttpError(response.status, detail, provider.label));
  }
  const data = (await response.json()) as OpenAiReply;
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error(`${provider.label} returned an empty response.`);
  return content;
}

async function requestGemini(args: GenerateArgs): Promise<string> {
  const { settings, item, platform, signal } = args;
  const provider = getProvider(settings.provider);
  const model = resolvedModel(settings);
  const url = `${resolvedBaseUrl(settings)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(item, platform) }] }],
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: 900,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(describeHttpError(response.status, detail, provider.label));
  }
  const data = (await response.json()) as GeminiReply;
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!content) throw new Error(`${provider.label} returned an empty response.`);
  return content;
}

function describeHttpError(status: number, detail: string, label: string): string {
  const trimmed = detail.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  switch (status) {
    case 400:
      return `${label}: request rejected (400). ${trimmed}`;
    case 401:
    case 403:
      return `${label}: key rejected (${status}). Check the API key.`;
    case 404:
      return `${label}: model not found (404). Pick another model.`;
    case 429:
      return `${label}: free-tier rate limit hit (429). Wait a moment or switch provider.`;
    default:
      return `${label}: HTTP ${status}. ${trimmed}`;
  }
}

/** Generate metadata with the configured provider. Throws on any failure. */
export async function generateWithProvider(args: GenerateArgs): Promise<StockMetadata> {
  const provider = getProvider(args.settings.provider);
  if (provider.id === 'offline') throw new Error('No AI provider selected.');
  const raw = provider.api === 'gemini' ? await requestGemini(args) : await requestOpenAi(args);
  return normalizeMetadata(parseModelJson(raw), args.platform);
}

/* ------------------------------------------------------------------ */
/* Connectivity checks                                                */
/* ------------------------------------------------------------------ */

export interface ProviderProbe {
  ok: boolean;
  message: string;
  /** Suggested models, when the provider can enumerate them. */
  models?: string[];
}

/** Ping the provider with the smallest possible request. */
export async function probeProvider(settings: AiSettings): Promise<ProviderProbe> {
  const provider = getProvider(settings.provider);
  try {
    if (provider.id === 'offline') return { ok: true, message: 'Built-in generator ready.' };

    if (provider.id === 'ollama') {
      const base = resolvedBaseUrl(settings);
      const tags = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(6000) });
      if (!tags.ok) throw new Error(`Ollama replied ${tags.status}`);
      const data = (await tags.json()) as { models?: { name: string }[] };
      const names = (data.models ?? []).map((m) => m.name);
      return {
        ok: true,
        message: names.length ? `Ollama running · ${names.length} model(s)` : 'Ollama running, no models pulled yet',
        models: names,
      };
    }

    if (!settings.apiKey.trim()) return { ok: false, message: 'Add an API key first.' };

    const probeItem = {
      id: 'probe',
      name: 'golden-retriever-puppy.jpg',
      format: 'jpg',
      sizeBytes: 1,
      metadata: { title: '', description: '', keywords: [], categories: [] },
      flags: { aiGenerated: false, aiTool: '', editorial: false, mature: false, illustration: false, license: 'pro' },
      embeddedAt: null,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as StockItem;

    const started = performance.now();
    const result = await generateWithProvider({ item: probeItem, settings });
    const ms = Math.round(performance.now() - started);
    return {
      ok: result.keywords.length > 0,
      message: result.keywords.length
        ? `Working · ${result.keywords.length} keywords in ${ms} ms`
        : 'Connected, but the reply had no keywords.',
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Providers grouped for the picker. */
export const PROVIDER_GROUPS = [
  { id: 'local' as const, label: 'On this computer', providers: AI_PROVIDERS.filter((p) => p.kind === 'local' || p.id === 'openai-compatible') },
  { id: 'cloud' as const, label: 'Free tiers (your key)', providers: AI_PROVIDERS.filter((p) => p.kind === 'cloud') },
];

/** Marketplaces that accept AI content — used to warn before export. */
export const AI_FRIENDLY = PLATFORM_LIST.filter((p) => p.aiPolicy === 'allowed-labeled').map((p) => p.id);
