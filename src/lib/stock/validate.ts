import { PLATFORMS, type PlatformSpec } from './platforms';
import { keywordsFor } from './csv';
import { kindOf, megapixels, type Issue, type PlatformId, type StockItem } from './types';

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const NON_ASCII = /[^\x20-\x7E]/;
const BAD_CHARS = /[,[\]<>{}#%&?*:\\|"]/;

export function sanitizeFilename(name: string, platform?: PlatformSpec): { name: string; changed: boolean } {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let clean = base
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[,[\]<>{}#%&?*:\\|"'`]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^-+|-+$/g, '');
  if (!clean) clean = 'asset';
  if (platform?.id === 'adobe') clean = clean.slice(0, 30 - ext.length);
  if (platform?.id === 'freepik') clean = clean.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  const out = clean + ext.toLowerCase();
  return { name: out, changed: out !== name };
}

export function validateItem(
  item: StockItem,
  platformId: PlatformId,
  siblings: StockItem[] = [],
): Issue[] {
  const platform = PLATFORMS[platformId];
  const issues: Issue[] = [];
  const kind = kindOf(item);
  const mp = megapixels(item);

  /* ---- format ---- */
  const allowed = kind === 'vector' ? platform.formats.vector : platform.formats.photo;
  if (allowed.length === 0) {
    issues.push({
      level: 'warn',
      scope: 'platform',
      platform: platformId,
      message: `${platform.name} does not accept ${item.format.toUpperCase()} through the standard route.`,
    });
  } else if (!allowed.includes(item.format)) {
    issues.push({
      level: 'error',
      scope: 'platform',
      platform: platformId,
      message: `${platform.name} expects ${allowed.map((f) => f.toUpperCase()).join('/')} for ${kind}s, got ${item.format.toUpperCase()}.`,
    });
  }

  /* ---- resolution / size (raster only) ---- */
  if (kind !== 'vector' && mp !== null) {
    if (mp < platform.minMP) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `${mp.toFixed(1)} MP is below ${platform.name}'s ${platform.minMP} MP minimum — upscale it first.`,
        hint: 'Use the Upscale studio with this platform preset.',
      });
    }
    if (platform.maxMP !== null && mp > platform.maxMP) {
      issues.push({
        level: 'error',
        scope: 'file',
        platform: platformId,
        message: `${mp.toFixed(1)} MP exceeds ${platform.name}'s ${platform.maxMP} MP maximum.`,
      });
    }
  }
  const sizeMB = item.sizeBytes / 1_048_576;
  if (sizeMB > platform.maxFileMB) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: `${sizeMB.toFixed(1)} MB exceeds the ${platform.maxFileMB} MB limit on ${platform.name}.`,
    });
  }
  if (platform.minFileMB && kind !== 'vector' && sizeMB < platform.minFileMB) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: `${sizeMB.toFixed(2)} MB is under ${platform.name}'s ${platform.minFileMB} MB minimum (re-save at higher JPEG quality).`,
    });
  }

  /* ---- filename ---- */
  if (NON_ASCII.test(item.name)) {
    issues.push({
      level: 'error',
      scope: 'file',
      platform: platformId,
      message: 'Filename contains non-ASCII characters — most importers silently drop the row.',
      hint: 'Use "Rename to platform-safe names" in the Export centre.',
    });
  } else if (BAD_CHARS.test(item.name.slice(0, item.name.lastIndexOf('.') || item.name.length))) {
    issues.push({
      level: 'warn',
      scope: 'file',
      platform: platformId,
      message: 'Filename uses characters that break CSV matching (comma, brackets, quotes…).',
    });
  }
  if (platform.id === 'adobe' && item.name.length > 30) {
    issues.push({ level: 'error', scope: 'file', platform: platformId, message: 'Adobe Stock CSV filenames must be ≤ 30 characters including extension.' });
  }

  /* ---- vector pairing ---- */
  if (kind === 'vector' && ['freepik', 'getty', '123rf', 'depositphotos'].includes(platformId)) {
    const base = item.name.replace(/\.[^.]+$/, '');
    const hasPreview = siblings.some((s) => s.id !== item.id && s.name.replace(/\.[^.]+$/, '') === base && s.format === 'jpg');
    if (!hasPreview) {
      issues.push({
        level: platformId === 'getty' ? 'error' : 'warn',
        scope: 'file',
        platform: platformId,
        message: `${platform.name} requires a same-named JPG preview next to the ${item.format.toUpperCase()}.`,
      });
    }
  }

  /* ---- keywords ---- */
  const keywords = keywordsFor(item, platform);
  if (keywords.length < platform.keywords.min) {
    issues.push({
      level: 'error',
      scope: 'metadata',
      platform: platformId,
      message: `${keywords.length} keywords — ${platform.name} needs at least ${platform.keywords.min}.`,
    });
  }
  if (keywords.length > platform.keywords.max) {
    issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: `Too many keywords (max ${platform.keywords.max}).` });
  }
  if (platform.id === 'vecteezy' && keywords.some((k) => /[^a-z0-9 ]/i.test(k))) {
    issues.push({ level: 'warn', scope: 'metadata', platform: platformId, message: 'Vecteezy rejects keywords with special characters (dashes, dots, parentheses).' });
  }
  if (platform.keywords.ordered && keywords.length > platform.keywords.sweetSpot[1]) {
    issues.push({
      level: 'info',
      scope: 'metadata',
      platform: platformId,
      message: `${platform.name} weights the first keywords hardest — keep ${platform.keywords.sweetSpot[0]}-${platform.keywords.sweetSpot[1]} strong terms, order matters.`,
    });
  }

  /* ---- title / description ---- */
  const title = item.metadata.title.trim();
  if (!title) {
    issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: 'Title is empty.' });
  } else {
    if (title.length > platform.title.maxChars) {
      issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: `Title is ${title.length} chars — ${platform.name} caps at ${platform.title.maxChars}.` });
    }
    if (platform.title.noCommas && title.includes(',')) {
      issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: `${platform.name} titles must not contain commas (they break the CSV).` });
    }
    if (platform.title.minWords && wordCount(title) < platform.title.minWords) {
      issues.push({ level: 'error', scope: 'metadata', platform: platformId, message: `Title needs ≥ ${platform.title.minWords} words on ${platform.name}.` });
    }
  }

  const description = (item.metadata.description || title).trim();
  if (platform.description.minWords && wordCount(description) < platform.description.minWords) {
    issues.push({
      level: 'error',
      scope: 'metadata',
      platform: platformId,
      message: `Description must be a real sentence of ≥ ${platform.description.minWords} words on ${platform.name}.`,
    });
  }
  if (description.length > platform.description.maxChars) {
    issues.push({ level: 'warn', scope: 'metadata', platform: platformId, message: `Description over ${platform.description.maxChars} chars will be truncated in exports.` });
  }

  /* ---- AI policy ---- */
  if (item.flags.aiGenerated && platform.aiPolicy === 'forbidden') {
    issues.push({
      level: 'error',
      scope: 'policy',
      platform: platformId,
      message: `${platform.name} rejects contributor generative-AI content outright.`,
      hint: platform.aiNote,
    });
  } else if (item.flags.aiGenerated && platform.aiPolicy === 'allowed-labeled') {
    issues.push({
      level: 'warn',
      scope: 'policy',
      platform: platformId,
      message: `AI content on ${platform.name} must be disclosed at submission.`,
      hint: platform.aiNote,
    });
  }

  /* ---- embedded metadata ---- */
  if (platform.readsEmbeddedMetadata && !item.embeddedAt && ['jpg', 'png', 'webp', 'svg', 'eps'].includes(item.format)) {
    issues.push({
      level: 'info',
      scope: 'metadata',
      platform: platformId,
      message: `${platform.name} reads embedded IPTC/XMP — embed metadata so the portal pre-fills.`,
    });
  }

  return issues;
}

export function validateEverywhere(item: StockItem, siblings: StockItem[]): Record<PlatformId, Issue[]> {
  const out = {} as Record<PlatformId, Issue[]>;
  for (const id of Object.keys(PLATFORMS) as PlatformId[]) {
    out[id] = validateItem(item, id, siblings);
  }
  return out;
}

export function worstLevel(issues: Issue[]): 'error' | 'warn' | 'info' | 'ok' {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.some((i) => i.level === 'warn')) return 'warn';
  if (issues.some((i) => i.level === 'info')) return 'info';
  return 'ok';
}
