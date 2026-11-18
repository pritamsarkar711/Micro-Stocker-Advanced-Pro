/**
 * Backup import.
 *
 * A backup file is untrusted input: it can come from another machine, an older
 * build, or a text editor. Every field is rebuilt explicitly, so a crafted JSON
 * payload cannot smuggle prototype keys, oversized strings or wrong types into
 * the library state.
 */
import type { ItemFlags, StockItem, StockMetadata, StockFormat } from './types';
import { DEFAULT_FLAGS } from './types';

const FORMATS: StockFormat[] = ['jpg', 'png', 'eps', 'ai', 'svg', 'webp', 'tiff', 'avif', 'bmp', 'gif', 'ico'];
const LICENSES: ItemFlags['license'][] = ['free', 'pro', 'editorial'];
const MAX_ITEMS = 20_000;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

const strings = (value: unknown, max: number, maxLength: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, max)
    : [];

const number = (value: unknown, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;

const isoDate = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
};

function sanitizeMetadata(raw: unknown): StockMetadata {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    title: text(source.title, 200),
    description: text(source.description, 2000),
    keywords: strings(source.keywords, 80, 60),
    categories: strings(source.categories, 4, 60),
  };
}

function sanitizeFlags(raw: unknown): ItemFlags {
  const source = (raw ?? {}) as Record<string, unknown>;
  const license = LICENSES.includes(source.license as ItemFlags['license'])
    ? (source.license as ItemFlags['license'])
    : DEFAULT_FLAGS.license;
  return {
    aiGenerated: source.aiGenerated === true,
    aiTool: text(source.aiTool, 60),
    aiPrompt: typeof source.aiPrompt === 'string' ? source.aiPrompt.slice(0, 1000) : undefined,
    editorial: source.editorial === true,
    mature: source.mature === true,
    illustration: source.illustration === true,
    license,
  };
}

export interface BackupImport {
  items: StockItem[];
  skipped: number;
  /** True when no item carries a filesystem path, so file bytes are not included. */
  metadataOnly: boolean;
}

/** Rebuild a library from a backup payload, dropping anything unusable. */
export function sanitizeBackup(payload: unknown): BackupImport {
  const source = (payload ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(source.items) ? source.items : null;
  if (!rawItems) return { items: [], skipped: 0, metadataOnly: true };

  const now = new Date().toISOString();
  const items: StockItem[] = [];
  let skipped = 0;

  for (const entry of rawItems.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== 'object') {
      skipped += 1;
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const name = text(raw.name, 255).replace(/[/\\]/g, '_');
    const id = text(raw.id, 80).replace(/[^a-zA-Z0-9-]/g, '');
    if (!name || !id) {
      skipped += 1;
      continue;
    }
    const format = FORMATS.includes(raw.format as StockFormat) ? (raw.format as StockFormat) : 'jpg';
    items.push({
      id,
      name,
      format,
      sizeBytes: number(raw.sizeBytes, 2_000_000_000) ?? 0,
      width: number(raw.width, 200_000),
      height: number(raw.height, 200_000),
      path: typeof raw.path === 'string' && raw.path.length < 4096 ? raw.path : undefined,
      thumbUrl: typeof raw.thumbUrl === 'string' && raw.thumbUrl.startsWith('data:image/')
        ? raw.thumbUrl.slice(0, 4_000_000)
        : undefined,
      inMemory: raw.inMemory === true,
      metadata: sanitizeMetadata(raw.metadata),
      flags: sanitizeFlags(raw.flags),
      releaseIds: strings(raw.releaseIds, 40, 80),
      embeddedAt: raw.embeddedAt ? isoDate(raw.embeddedAt, now) : null,
      importedAt: isoDate(raw.importedAt, now),
      updatedAt: isoDate(raw.updatedAt, now),
    });
  }

  return {
    items,
    skipped,
    metadataOnly: items.length > 0 && items.every((item) => !item.path && !item.thumbUrl),
  };
}
