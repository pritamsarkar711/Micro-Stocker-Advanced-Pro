import type { PlatformSpec } from './platforms';
import type { StockItem, StockMetadata } from './types';

/**
 * Local, offline metadata generator.
 *
 * It combines: filename tokens -> subject synonyms -> style vocabulary ->
 * category concept banks -> ordered, de-duplicated keyword lists that respect
 * each platform's limits. No network, no keys, deterministic.
 *
 * An optional BYO OpenAI-compatible endpoint can enrich/replace the output
 * (Settings > AI assistant) for users who want LLM-written copy.
 */

const SYNONYMS: Record<string, string[]> = {
  background: ['background', 'backdrop', 'texture', 'surface'],
  pattern: ['pattern', 'seamless', 'repeating', 'tile'],
  banner: ['banner', 'header', 'cover', 'layout'],
  logo: ['logo', 'emblem', 'badge', 'symbol'],
  icon: ['icon', 'glyph', 'pictogram', 'symbol'],
  flower: ['flower', 'blossom', 'floral', 'botanical'],
  tree: ['tree', 'forest', 'wood', 'nature'],
  city: ['city', 'urban', 'skyline', 'town'],
  beach: ['beach', 'sea', 'coast', 'summer'],
  mountain: ['mountain', 'peak', 'landscape', 'alpine'],
  food: ['food', 'meal', 'cuisine', 'dish'],
  coffee: ['coffee', 'cafe', 'espresso', 'cup'],
  business: ['business', 'corporate', 'office', 'professional'],
  technology: ['technology', 'tech', 'digital', 'innovation'],
  abstract: ['abstract', 'geometric', 'modern', 'creative'],
  animal: ['animal', 'wildlife', 'fauna', 'creature'],
  dog: ['dog', 'puppy', 'pet', 'canine'],
  cat: ['cat', 'kitten', 'feline', 'pet'],
  woman: ['woman', 'female', 'lady', 'person'],
  man: ['man', 'male', 'person', 'gentleman'],
  child: ['child', 'kid', 'boy', 'girl'],
  frame: ['frame', 'border', 'template', 'design'],
  card: ['card', 'invitation', 'template', 'greeting'],
  label: ['label', 'tag', 'sticker', 'badge'],
  leaf: ['leaf', 'foliage', 'plant', 'green'],
  sun: ['sun', 'sunny', 'sunlight', 'day'],
  water: ['water', 'liquid', 'splash', 'drop'],
  gold: ['gold', 'golden', 'luxury', 'premium'],
  vintage: ['vintage', 'retro', 'classic', 'old'],
  minimal: ['minimal', 'simple', 'clean', 'minimalist'],
};

const CATEGORY_BANK: Record<string, string[]> = {
  backgrounds: ['background', 'texture', 'backdrop', 'wallpaper', 'surface'],
  abstract: ['abstract', 'geometric', 'shape', 'modern', 'creative'],
  business: ['business', 'finance', 'corporate', 'office', 'success', 'team'],
  technology: ['technology', 'digital', 'innovation', 'network', 'data', 'ai'],
  nature: ['nature', 'environment', 'landscape', 'outdoor', 'ecology'],
  animals: ['animal', 'wildlife', 'pet', 'zoo', 'fauna'],
  food: ['food', 'drink', 'cuisine', 'recipe', 'delicious', 'fresh'],
  people: ['people', 'person', 'lifestyle', 'portrait', 'human'],
  travel: ['travel', 'tourism', 'vacation', 'journey', 'destination'],
  health: ['health', 'medical', 'wellness', 'care', 'healthy'],
  education: ['education', 'school', 'learning', 'study', 'knowledge'],
  holidays: ['holiday', 'celebration', 'festival', 'season', 'greeting'],
  'beauty-fashion': ['beauty', 'fashion', 'style', 'cosmetic', 'elegant'],
  buildings: ['building', 'architecture', 'construction', 'structure'],
};

const VECTOR_STYLE = ['vector', 'illustration', 'graphic', 'design', 'flat', 'isolated', 'white background'];
const PHOTO_STYLE = ['photo', 'photography', 'realistic', 'high resolution', 'closeup', 'natural light'];
const USE_WORDS = ['template', 'concept', 'creative', 'modern', 'professional', 'commercial', 'print', 'web'];

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

export interface GenerateOptions {
  subject?: string;
  style: 'auto' | 'vector' | 'photo';
  categories: string[];
  concepts: string[];
}

export function tokensFromFilename(name: string): string[] {
  return name
    .replace(/\.[^.]+$/, '')
    .split(/[-_\s.()\[\]{}]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !/^\d+$/.test(t) && t.length > 2 && !['final', 'copy', 'new', 'img', 'image', 'file', 'export', 'preview'].includes(t));
}

export function generateMetadata(item: StockItem, options: GenerateOptions): StockMetadata {
  const isVector = options.style === 'vector' || (options.style === 'auto' && ['eps', 'ai', 'svg'].includes(item.format));
  const styleWords = isVector ? VECTOR_STYLE : PHOTO_STYLE;

  const fileTokens = tokensFromFilename(item.name);
  const subjectTokens = (options.subject ? options.subject.toLowerCase().split(/\s*,\s*|\s+/).filter(Boolean) : []).concat(fileTokens);
  const subject = subjectTokens.length ? subjectTokens.join(' ') : (isVector ? 'design element' : 'scene');

  // synonym expansion
  const expanded: string[] = [];
  for (const token of subjectTokens) {
    expanded.push(...(SYNONYMS[token] ?? [token]));
  }
  const subjectWords = Array.from(new Set([...subjectTokens, ...expanded]));

  const categoryWords = options.categories.flatMap((c) => CATEGORY_BANK[c] ?? [c]);
  const conceptWords = options.concepts.map((c) => c.trim()).filter(Boolean);

  /* ---- keywords, strongest first ---- */
  const keywords: string[] = [];
  const push = (words: string[]) => {
    for (const w of words) {
      const clean = w.toLowerCase().replace(/\s+/g, ' ').trim();
      if (clean && !keywords.includes(clean)) keywords.push(clean);
    }
  };
  push(subjectWords);
  push(conceptWords);
  push(styleWords);
  push(categoryWords);
  push(USE_WORDS);

  /* ---- title ---- */
  const title = isVector
    ? `${titleCase(subject)} vector illustration, ${options.categories[0] ? `${options.categories[0].replace('-', ' ')} ` : ''}${conceptWords[0] ?? 'flat'} design`
    : `${titleCase(subject)}${conceptWords[0] ? ` with ${conceptWords[0]}` : ''}, ${options.categories[0] ? `${options.categories[0].replace('-', ' ')} ` : ''}photography`;

  /* ---- description (a real sentence) ---- */
  const description = isVector
    ? `A ${styleWords[4] ?? 'flat'} vector illustration of ${subject}${conceptWords.length ? ` featuring ${conceptWords.slice(0, 2).join(' and ')}` : ''}, designed for ${options.categories[0] ?? 'creative'} projects, prints and web layouts.`
    : `A high resolution photograph of ${subject}${conceptWords.length ? ` with ${conceptWords.slice(0, 2).join(' and ')}` : ''}, suitable for ${options.categories[0] ?? 'editorial'} and commercial use.`;

  return {
    title: title.slice(0, 180),
    description: description.slice(0, 400),
    keywords: keywords.slice(0, 50),
    categories: options.categories.slice(0, 2),
  };
}

/** Platform adaptation: caps, ordering rules, comma safety. */
export function adaptForPlatform(metadata: StockMetadata, platform: PlatformSpec): StockMetadata {
  let title = metadata.title.trim();
  if (platform.title.noCommas) title = title.replace(/,/g, ' ');
  title = title.slice(0, platform.title.maxChars);

  const seen = new Set<string>();
  let keywords = metadata.keywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => {
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // Ordered platforms (Adobe, Vecteezy, Getty): title words inside the top 10.
  if (platform.keywords.ordered) {
    const titleWords = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const score = (k: string, i: number) =>
      (titleWords.has(k.split(' ')[0]) ? 1000 : 0) + (keywords.length - i);
    keywords = keywords
      .map((k, i) => [k, score(k, i)] as const)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }

  return {
    title,
    description: metadata.description.slice(0, platform.description.maxChars),
    keywords: keywords.slice(0, platform.keywords.max),
    categories: metadata.categories.slice(0, 2),
  };
}

/* -------------------------------------------------------------------------- */
/* Optional BYO LLM (user's own key; never stored on any server of ours)       */
/* -------------------------------------------------------------------------- */

export interface AiAssistantConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function generateWithAi(
  item: StockItem,
  config: AiAssistantConfig,
  signal?: AbortSignal,
): Promise<StockMetadata> {
  const prompt = [
    'You are a microstock metadata expert. Return STRICT JSON only:',
    '{"title": string, "description": string, "keywords": string[]}',
    `File: ${item.name} (${item.format}).`,
    'Rules: title = one descriptive English sentence 8-20 words, no commas if possible;',
    'description = one factual sentence; keywords = 25-40 relevant English search terms,',
    'strongest first, no duplicates, no brand names.',
  ].join('\n');

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`AI endpoint replied ${response.status}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI endpoint returned no JSON');
  const parsed = JSON.parse(jsonMatch[0]) as Partial<StockMetadata>;
  return {
    title: String(parsed.title ?? '').slice(0, 200),
    description: String(parsed.description ?? '').slice(0, 500),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 50) : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories.map(String).slice(0, 2) : [],
  };
}
