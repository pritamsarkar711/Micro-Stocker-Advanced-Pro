import { PLATFORMS, type PlatformSpec } from './platforms';
import { keywordsFor } from './csv';
import { kindOf, megapixels, type Issue, type PlatformId, type StockItem } from './types';

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const NON_ASCII = /[^\x20-\x7E]/;
const BAD_CHARS = /[,[\]<>{}#%&?*:\\|"]/;
const EMBEDDABLE_FORMATS = new Set(['jpg', 'png', 'webp', 'svg', 'eps']);
const PAIRED_VECTOR_PLATFORMS = new Set<PlatformId>(['freepik', 'getty', '123rf', 'depositphotos', 'pond5', 'vectorstock']);
const PEOPLE_WORDS = new Set([
  'woman',
  'man',
  'people',
  'person',
  'child',
  'kid',
  'boy',
  'girl',
  'portrait',
  'face',
  'model',
  'family',
  'couple',
]);

/** Precomputed index for O(1) cross item checks across large libraries. */
export interface ValidationIndex {
  jpgStems: Set<string>;
  titleCounts: Map<string, number>;
}

export function buildValidationIndex(items: StockItem[]): ValidationIndex {
  const jpgStems = new Set<string>();
  const titleCounts = new Map<string, number>();
  for (const item of items) {
    if (item.format === 'jpg') {
      jpgStems.add(item.name.replace(/\.[^.]+$/, '').toLowerCase());
    }
    const t = item.metadata.title.trim().toLowerCase();
    if (t) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  }
  return { jpgStems, titleCounts };
}

export function sanitizeFilename(name: string, platform?: PlatformSpec): { name: string; changed: boolean } {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
  let clean = base
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[,[\]<>{}#%&?*:\\|"'`]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!clean) clean = 'asset';
  if (platform?.id === 'adobe') clean = clean.slice(0, Math.max(4, 30 - ext.length));
  if (platform?.id === 'freepik') clean = clean.replace(/[^A-Za-z0-9_]/g, '').slice(0, 60) || 'asset';
  const out = clean + ext;
  return { name: out, changed: out !== name };
}

export function validateItem(
  item: StockItem,
  platformId: PlatformId,
  siblings: StockItem[] = [],
  index?: ValidationIndex,
): Issue[] {
  const platform = PLATFORMS[platformId];
  const issues: Issue[] = [];
  const kind = kindOf(item);
  const mp = megapixels(item);
  const idx = index ?? (siblings.length ? buildValidationIndex(siblings) : undefined);

  /* Format rules */
  const allowed = kind === 'vector' ? platform.formats.vector : platform.formats.photo;
  if (allowed.length === 0) {
    issues.push({
      level: 'warn',
      scope: 'platform',
      platform: platformId,
      message: `${platform.name} does not accept ${item.format.toUpperCase()} in its standard workflow.`,
    });
  } else if (!allowed.includes(item.format)) {
    issues.push({
      level: 'error',
      scope: 'platform',
      platform: platformId,
      message: `${platform.name} requires ${allowed.map((f) => f.toUpperCase()).join(' or ')} for ${kind === 'vector' ? 'vectors' : 'images'}, received ${item.format.toUpperCase()}.`,
      hint: 'Convert this file in Image Converter before exporting.',
    });
  }

  /* Pixel resolution & megapixel limits */
  if (kind !== 'vector' && mp !== null) {
    if (mp < platform.minMP) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `${mp.toFixed(1)} MP is below the ${platform.minMP} MP minimum for ${platform.name}.`,
        hint: 'Open Image Upscaler and select this marketplace target.',
      });
    }
    if (platform.maxMP !== null && mp > platform.maxMP) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `${mp.toFixed(1)} MP exceeds the ${platform.maxMP} MP ceiling for ${platform.name}.`,
      });
    }
  }
  if (kind !== 'vector' && item.width && item.height) {
    const shortest = Math.min(item.width, item.height);
    const longest = Math.max(item.width, item.height);
    if (platform.minDimensionPx && longest < platform.minDimensionPx) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `Longest edge is ${longest} px; ${platform.name} requires at least ${platform.minDimensionPx} px.`,
      });
    }
    if (platform.maxDimensionPx && longest > platform.maxDimensionPx) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `Longest edge ${longest} px exceeds the ${platform.maxDimensionPx} px limit on ${platform.name}.`,
      });
    }
    if (platformId === 'canva' && item.format === 'png' && shortest < 1500) {
      issues.push({
        level: 'info',
        scope: 'file',
        platform: platformId,
        message: 'Canva recommends at least 1500 by 1500 px for transparent PNG cutouts.',
      });
    }
  }

  /* File byte size limits */
  const maxMB = kind === 'vector' && platformId === 'shutterstock' ? 100 : kind === 'vector' && platformId === 'freepik' ? 80 : platform.maxFileMB;
  const sizeMB = item.sizeBytes / 1_048_576;
  if (sizeMB > maxMB) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: `${sizeMB.toFixed(1)} MB exceeds the ${maxMB} MB limit on ${platform.name}.`,
    });
  }
  if (platform.minFileMB && kind !== 'vector' && item.sizeBytes > 0 && sizeMB < platform.minFileMB) {
    issues.push({
      level: 'warn',
      scope: 'file',
      platform: platformId,
      message: `${sizeMB.toFixed(2)} MB is below the ${platform.minFileMB} MB minimum on ${platform.name}; save at higher JPG quality.`,
    });
  }

  /* Filename check */
  if (NON_ASCII.test(item.name)) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: 'Filename contains non ASCII characters that cause CSV upload mismatches.',
      hint: 'Run safe filename cleanup in Export.',
    });
  } else if (BAD_CHARS.test(item.name.slice(0, item.name.lastIndexOf('.') || item.name.length))) {
    issues.push({
      level: 'warn',
      scope: 'file',
      platform: platformId,
      message: 'Filename contains punctuation that can interrupt CSV row matching.',
    });
  }
  if (platform.id === 'adobe' && item.name.length > 30) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: 'Adobe Stock CSV filenames must be 30 characters or fewer including extension.',
    });
  }

  /* Vector preview pairing */
  if (kind === 'vector' && PAIRED_VECTOR_PLATFORMS.has(platformId) && idx) {
    const stem = item.name.replace(/\.[^.]+$/, '').toLowerCase();
    if (!idx.jpgStems.has(stem)) {
      issues.push({
        level: platformId === 'getty' ? 'error' : 'warn',
        scope: 'file',
        platform: platformId,
        message: `${platform.name} expects a matching JPG preview alongside the ${item.format.toUpperCase()} file.`,
      });
    }
  }

  /* Keyword count & formatting */
  const keywords = keywordsFor(item, platform);
  if (keywords.length < platform.keywords.min) {
    issues.push({
      level: 'error',
      scope: 'metadata',
      platform: platformId,
      message: `${keywords.length} keywords entered; ${platform.name} requires at least ${platform.keywords.min}.`,
    });
  }
  if (keywords.length > platform.keywords.max) {
    issues.push({
      level: 'error',
      scope: 'metadata',
      platform: platformId,
      message: `Exceeds the ${platform.keywords.max} keyword limit on ${platform.name}.`,
    });
  }
  if (platform.id === 'vecteezy' && keywords.some((k) => /[^a-z0-9 ]/i.test(k))) {
    issues.push({
      level: 'warn',
      scope: 'metadata',
      platform: platformId,
      message: 'Vecteezy rejects keywords containing punctuation or symbols.',
    });
  }
  if (platform.keywords.ordered && keywords.length > platform.keywords.sweetSpot[1]) {
    issues.push({
      level: 'info',
      scope: 'metadata',
      platform: platformId,
      message: `${platform.name} prioritizes leading keywords; place your strongest terms within the first ${platform.keywords.sweetSpot[0]} to ${platform.keywords.sweetSpot[1]} tags.`,
    });
  }

  /* Title & description checks */
  const title = item.metadata.title.trim();
  if (!title) {
    issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: 'Title is empty.' });
  } else {
    if (title.length > platform.title.maxChars) {
      issues.push({
        level: 'error',
        scope: 'metadata',
        platform: platformId,
        message: `Title has ${title.length} characters; ${platform.name} allows at most ${platform.title.maxChars}.`,
      });
    } else if (platform.title.recommendedChars && title.length > platform.title.recommendedChars) {
      issues.push({
        level: 'info',
        scope: 'metadata',
        platform: platformId,
        message: `Keeping titles under ${platform.title.recommendedChars} characters improves search ranking on ${platform.name}.`,
      });
    }
    if (platform.title.noCommas && title.includes(',')) {
      issues.push({
        level: 'error',
        scope: 'metadata',
        platform: platformId,
        message: `${platform.name} titles cannot include commas.`,
      });
    }
    if (platform.title.minWords && wordCount(title) < platform.title.minWords) {
      issues.push({
        level: 'error',
        scope: 'metadata',
        platform: platformId,
        message: `Title needs at least ${platform.title.minWords} words on ${platform.name}.`,
      });
    }
    if (platformId === 'canva' && idx && (idx.titleCounts.get(title.toLowerCase()) ?? 0) > 1) {
      issues.push({
        level: 'warn',
        scope: 'metadata',
        platform: platformId,
        message: 'Canva requires a unique title for every asset in a batch.',
      });
    }
  }

  const description = (item.metadata.description || title).trim();
  if (platform.description.minWords && wordCount(description) < platform.description.minWords) {
    issues.push({
      level: 'error',
      scope: 'metadata',
      platform: platformId,
      message: `Description needs a sentence of at least ${platform.description.minWords} words on ${platform.name}.`,
    });
  }
  if (description.length > platform.description.maxChars) {
    issues.push({
      level: 'warn',
      scope: 'metadata',
      platform: platformId,
      message: `Description over ${platform.description.maxChars} characters will be trimmed on export.`,
    });
  }

  /* AI content policy */
  if (item.flags.aiGenerated && platform.aiPolicy === 'forbidden') {
    issues.push({
      level: 'error',
      scope: 'policy',
      platform: platformId,
      message: `${platform.name} prohibits contributor generative AI content.`,
      hint: platform.aiNote,
    });
  } else if (item.flags.aiGenerated && platform.aiPolicy === 'allowed-labeled') {
    issues.push({
      level: 'info',
      scope: 'policy',
      platform: platformId,
      message: `Enable the generative AI disclosure flag when uploading to ${platform.name}.`,
      hint: platform.aiNote,
    });
  }

  /* Commercial trademark safety check */
  if (!item.flags.editorial) {
    const trademarkMatch = /\b(iphone|ipad|macbook|nike|adidas|tesla|disney|lego|rolex|gucci|starbucks|coca cola|pepsi|canon|nikon|sony|playstation|xbox)\b/i.exec(
      `${title} ${description} ${item.metadata.keywords.join(' ')}`,
    );
    if (trademarkMatch) {
      issues.push({
        level: 'warn',
        scope: 'policy',
        platform: platformId,
        message: `Trademark term "${trademarkMatch[1]}" detected in commercial asset metadata.`,
        hint: 'Remove brand names for commercial licensing or enable editorial mode.',
      });
    }
  }

  /* Recognizable people release check */
  const looksLikePeople =
    item.metadata.keywords.some((k) => PEOPLE_WORDS.has(k.split(' ')[0]?.toLowerCase() ?? '')) ||
    /\b(people|portrait|woman|man|child|family|couple)\b/i.test(item.metadata.title);
  if (looksLikePeople && !item.flags.editorial && !(item.releaseIds ?? []).length) {
    issues.push({
      level: 'warn',
      scope: 'policy',
      platform: platformId,
      message: 'Asset mentions people without a linked model release.',
      hint: 'Attach a signed release in Releases or enable editorial mode.',
    });
  }

  /* Embedded metadata reminder */
  if (platform.readsEmbeddedMetadata && !item.embeddedAt && EMBEDDABLE_FORMATS.has(item.format)) {
    issues.push({
      level: 'info',
      scope: 'metadata',
      platform: platformId,
      message: `${platform.name} reads embedded IPTC and XMP metadata automatically.`,
    });
  }

  return issues;
}

export function validateEverywhere(
  item: StockItem,
  siblings: StockItem[],
  index?: ValidationIndex,
): Record<PlatformId, Issue[]> {
  const shared = index ?? buildValidationIndex(siblings);
  const out = {} as Record<PlatformId, Issue[]>;
  for (const id of Object.keys(PLATFORMS) as PlatformId[]) {
    out[id] = validateItem(item, id, siblings, shared);
  }
  return out;
}

export function worstLevel(issues: Issue[]): 'error' | 'warn' | 'info' | 'ok' {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.some((i) => i.level === 'warn')) return 'warn';
  if (issues.some((i) => i.level === 'info')) return 'info';
  return 'ok';
}
