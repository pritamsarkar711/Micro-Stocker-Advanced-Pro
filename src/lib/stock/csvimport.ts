import { PLATFORMS, PLATFORM_LIST, findPlatform } from './platforms';
import type { PlatformId, StockItem } from './types';

/**
 * Metadata CSV import (the inverse of `csv.ts`).
 *
 * Contributors usually already own a CSV: an earlier export from this app, a
 * Xpiks/other-tool dump, or a sheet downloaded back from a portal. This module
 * sniffs the dialect (delimiter, quote character, header or headerless) and
 * turns every row into metadata that can be applied to library items by
 * filename.
 */

export interface MetadataRow {
  filename: string;
  title?: string;
  description?: string;
  keywords?: string[];
  categories?: string[];
  editorial?: boolean;
  mature?: boolean;
  illustration?: boolean;
  aiGenerated?: boolean;
}

export interface MetadataCsvParse {
  /** Dialect the parser settled on (null = generic sniffing). */
  platform: PlatformId | null;
  delimiter: string;
  hasHeader: boolean;
  /** Resolved column names in positional order. */
  columns: string[];
  rows: MetadataRow[];
  /** Row count skipped because no filename could be found. */
  skipped: number;
}

const HEADER_TOKENS = new Set([
  'filename',
  'file name',
  'file',
  'title',
  'description',
  'keywords',
  'keyword',
  'categories',
  'category',
  'category1',
  'category2',
  'editorial',
  'mature content',
  'nudity',
  'illustration',
  'license',
  'country',
]);

const FILENAME_RE = /\.[a-z0-9]{2,5}$/i;

/** Split a row into fields honouring either quote character (Freepik uses '). */
export function splitFields(line: string, delimiter: string, quote: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === quote) {
        if (line[i + 1] === quote) {
          field += quote;
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === quote) quoted = true;
    else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else field += char;
  }
  fields.push(field);
  return fields.map((value) => value.trim());
}

export const DIALECT_CANDIDATES: [string, string][] = [
  [',', '"'],
  [';', "'"],
  [';', '"'],
  ['\t', '"'],
  [',', "'"],
  ['|', '"'],
];

/**
 * Delimiter + quote-character sniffing.
 *
 * Field count alone is misleading: a semicolon/single-quoted Freepik sheet
 * splits into dozens of "fields" on its keyword commas. Quote characters that
 * actually appear in the text and a consistent field count across lines are
 * far stronger signals, so they dominate the score.
 */
export function sniffDialect(text: string): { delimiter: string; quote: string } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 8);
  if (lines.length === 0) return { delimiter: ',', quote: '"' };

  let best = { delimiter: ',', quote: '"', score: Number.NEGATIVE_INFINITY };
  for (const [delimiter, quote] of DIALECT_CANDIDATES) {
    const counts = lines.map((line) => splitFields(line, delimiter, quote).length);
    const tally = new Map<number, number>();
    for (const count of counts) tally.set(count, (tally.get(count) ?? 0) + 1);
    const [modalCount, modalLines] = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
    if (modalCount < 2) continue; // this delimiter splits nothing

    const quotePattern = quote === '"' ? /\"/g : /'/g;
    const quoteUsed = (text.match(quotePattern)?.length ?? 0) >= 2;
    const consistency = modalLines / counts.length;
    const ragged = counts.some((count) => count < 2) ? 25 : 0;
    const score = (quoteUsed ? 100 : 0) + consistency * 10 - ragged;
    if (score > best.score) best = { delimiter, quote, score };
  }
  return { delimiter: best.delimiter, quote: best.quote };
}

function looksLikeHeader(fields: string[]): boolean {
  if (fields.length === 0) return false;
  const hits = fields.filter((field) => HEADER_TOKENS.has(field.toLowerCase())).length;
  return hits >= 2 || (hits === 1 && !fields.some((field) => FILENAME_RE.test(field)));
}

/** Column synonym → canonical role. */
export type ColumnRole =
  | 'filename'
  | 'title'
  | 'description'
  | 'keywords'
  | 'category'
  | 'editorial'
  | 'mature'
  | 'illustration';

function roleOf(header: string): ColumnRole | null {
  const key = header.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (['filename', 'file name', 'file', 'name'].includes(key)) return 'filename';
  if (['title', 'headline'].includes(key)) return 'title';
  if (['description', 'caption', 'desc'].includes(key)) return 'description';
  if (['keywords', 'keyword', 'tags', 'key words'].includes(key)) return 'keywords';
  if (['categories', 'category', 'category1', 'category2', 'genre'].includes(key)) return 'category';
  if (['editorial', 'editorial usage'].includes(key)) return 'editorial';
  if (['mature content', 'nudity', 'mature', 'adult content'].includes(key)) return 'mature';
  if (['illustration', 'vector'].includes(key)) return 'illustration';
  return null;
}

function splitKeywords(value: string | undefined): string[] | undefined {
  if (!value || !value.trim()) return undefined;
  return Array.from(
    new Set(
      value
        .split(/[,;|]/)
        .map((keyword) => keyword.trim().replace(/^["']+|["']+$/g, '').toLowerCase())
        .filter((keyword) => keyword.length > 0),
    ),
  );
}

function yesValue(value: string | undefined): boolean | undefined {
  if (!value || !value.trim()) return undefined;
  return /^(y|yes|true|1)$/i.test(value.trim());
}

function detectPlatform(columns: string[], delimiter: string, hasHeader: boolean): PlatformId | null {
  if (!hasHeader) return delimiter === ';' ? 'freepik' : null;
  const normalised = columns.map((column) => column.toLowerCase());
  let best: { id: PlatformId; score: number } | null = null;
  for (const platform of PLATFORM_LIST) {
    if (!platform.csv) continue;
    const wanted = platform.csv.columns.map((column) => column.toLowerCase());
    const score = wanted.filter((column) => normalised.includes(column)).length;
    if (score > 1 && (!best || score > best.score)) best = { id: platform.id, score };
  }
  if (best) return best.id;
  const fromLabel = findPlatform(normalised[0] ?? '');
  return fromLabel;
}

export function parseMetadataCsv(text: string, forced?: PlatformId): MetadataCsvParse {
  const clean = text.replace(/^\uFEFF/, '');
  const forcedSpec = forced ? PLATFORMS[forced].csv : null;
  const sniffed = sniffDialect(clean);
  const delimiter = forcedSpec?.delimiter ?? sniffed.delimiter;
  const quote = forcedSpec?.quote ?? sniffed.quote;
  const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== '');
  const table = lines.map((line) => splitFields(line, delimiter, quote));
  if (table.length === 0) {
    return { platform: null, delimiter, hasHeader: false, columns: [], rows: [], skipped: 0 };
  }

  const hasHeader = looksLikeHeader(table[0]);
  const dialect = forcedSpec ?? PLATFORMS.freepik.csv!;
  const columns = hasHeader
    ? table[0]
    : (dialect?.columns ?? ['Filename', 'Title', 'Keywords']).slice(0, Math.max(...table.map((row) => row.length)));

  const roles = columns.map((column, index) => ({
    index,
    role: hasHeader ? roleOf(column) : (['filename', 'title', 'keywords'] as const)[index] ?? null,
  }));

  const body = hasHeader ? table.slice(1) : table;
  const rows: MetadataRow[] = [];
  let skipped = 0;

  for (const fields of body) {
    const row: MetadataRow = { filename: '' };
    for (const { index, role } of roles) {
      const value = fields[index];
      if (value === undefined || !role) continue;
      switch (role) {
        case 'filename':
          row.filename = value.replace(/^.*[\\/]/, '');
          break;
        case 'title':
          if (value.trim()) row.title = value.trim();
          break;
        case 'description':
          if (value.trim()) row.description = value.trim();
          break;
        case 'keywords':
          row.keywords = splitKeywords(value);
          break;
        case 'category':
          row.categories = splitKeywords(value)?.map((cat) => cat.replace(/\b\w/g, (c) => c.toUpperCase()));
          break;
        case 'editorial':
          row.editorial = yesValue(value);
          break;
        case 'mature':
          row.mature = yesValue(value);
          break;
        case 'illustration':
          row.illustration = yesValue(value);
          break;
        default:
          break;
      }
    }

    if (!row.filename) {
      /* Headerless sheets: fall back to positional sniffing. */
      const name = fields.find((field) => FILENAME_RE.test(field.trim()));
      if (!name) {
        skipped++;
        continue;
      }
      row.filename = name.replace(/^.*[\\/]/, '').trim();
      const keywords = fields.find((field) => field !== name && (field.match(/,/g)?.length ?? 0) >= 2);
      row.keywords = splitKeywords(keywords);
      const rest = fields.filter((field) => field !== name && field !== keywords && field.trim());
      if (rest.length === 1) row.title = rest[0].trim();
      else if (rest.length >= 2) {
        row.title = rest[0].trim();
        row.description = rest[1].trim();
      }
    }

    /* AI disclosure keyword (Freepik) also flips the flag. */
    if (row.keywords?.includes('_ai_generated') || row.keywords?.includes('ai generated')) {
      row.aiGenerated = true;
    }
    rows.push(row);
  }

  return {
    platform: forced ?? detectPlatform(columns, delimiter, hasHeader),
    delimiter,
    hasHeader,
    columns,
    rows,
    skipped,
  };
}

/** Filename normalisation used for matching rows to library items. */
export function matchKey(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').trim().toLowerCase();
  return base.includes('.') ? base : `${base}.*`;
}

export interface ApplyResult {
  matched: number;
  updated: number;
  missing: string[];
}

/**
 * Pure matching helper: which library item each row belongs to.
 * The library provider applies the metadata through this plan.
 */
export function planApply(items: StockItem[], rows: MetadataRow[]): Map<MetadataRow, StockItem> {
  const byName = new Map<string, StockItem>();
  const byStem = new Map<string, StockItem>();
  for (const item of items) {
    byName.set(matchKey(item.name), item);
    byStem.set(item.name.replace(/\.[^.]+$/, '').toLowerCase(), item);
  }
  const plan = new Map<MetadataRow, StockItem>();
  for (const row of rows) {
    const key = matchKey(row.filename);
    const stem = row.filename.replace(/\.[^.]+$/, '').toLowerCase();
    const item = byName.get(key) ?? byStem.get(stem);
    if (item) plan.set(row, item);
  }
  return plan;
}
