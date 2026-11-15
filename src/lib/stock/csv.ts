import { PLATFORMS, type PlatformSpec } from './platforms';
import type { PlatformId, StockItem } from './types';

/**
 * Per-platform CSV builders.
 *
 * Schemas follow the official importer expectations researched in Nov 2026:
 *  - Shutterstock : header, comma, Description doubles as title
 *  - Adobe Stock  : header, comma, exact template, ≤5000 rows / 1 MB
 *  - Freepik      : NO header, semicolon, single-quoted fields
 *  - Dreamstime   : header, comma, Title+Description separate
 *  - 123RF        : header, comma, + Country
 *  - Depositphotos: header, comma, Editorial/Nudity flags
 *  - Vecteezy     : header, comma, License column, quoted keyword field
 *  - Pixabay/Getty/Alamy: no CSV importer -> generic copy-paste sheet
 */

function field(value: string, spec: PlatformSpec): string {
  const needsQuotes =
    value.includes(spec.csv!.delimiter) ||
    value.includes(spec.csv!.quote) ||
    /[\r\n]/.test(value);
  if (!needsQuotes) return value;
  const q = spec.csv!.quote;
  return q + value.split(q).join(q + q) + q;
}

export function keywordsFor(item: StockItem, platform: PlatformSpec): string[] {
  const seen = new Set<string>();
  const cleaned = item.metadata.keywords
    .map((k) => k.trim().replace(/\s+/g, ' '))
    .filter((k) => {
      const key = k.toLowerCase();
      if (!k || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  let list = cleaned.slice(0, platform.keywords.max);
  if (platform.id === 'freepik' && item.flags.aiGenerated && !list.includes('_ai_generated')) {
    list = [...list.slice(0, platform.keywords.max - 1), '_ai_generated'];
  }
  return list;
}

function titleFor(item: StockItem, platform: PlatformSpec): string {
  let title = item.metadata.title.trim();
  if (platform.title.noCommas) title = title.replace(/,/g, ' ');
  return title.slice(0, platform.title.maxChars);
}

function descriptionFor(item: StockItem, platform: PlatformSpec): string {
  const description = (item.metadata.description || item.metadata.title).trim();
  return description.slice(0, platform.description.maxChars);
}

function yesNo(value: boolean, style: 'Yes' | 'yes'): string {
  return value ? style : style === 'Yes' ? 'No' : 'no';
}

function columnValue(column: string, item: StockItem, platform: PlatformSpec): string {
  const key = column.toLowerCase();
  const keywords = keywordsFor(item, platform);

  switch (key) {
    case 'filename':
      return item.name;
    case 'title':
      return titleFor(item, platform);
    case 'description':
      // Shutterstock has no separate title column: description carries both.
      if (platform.id === 'shutterstock') {
        return (item.metadata.description || item.metadata.title).trim().slice(0, 200);
      }
      return descriptionFor(item, platform);
    case 'keywords':
      return keywords.join(platform.csv!.keywordJoin);
    case 'categories':
      return item.metadata.categories.slice(0, 2).join(', ');
    case 'category':
    case 'category1':
      return item.metadata.categories[0] ?? '';
    case 'category2':
      return item.metadata.categories[1] ?? '';
    case 'editorial':
      return platform.id === 'depositphotos'
        ? yesNo(item.flags.editorial, 'yes')
        : yesNo(item.flags.editorial, 'Yes');
    case 'mature content':
    case 'nudity':
      return platform.id === 'depositphotos'
        ? yesNo(item.flags.mature, 'yes')
        : yesNo(item.flags.mature, 'Yes');
    case 'illustration':
      return yesNo(item.flags.illustration, 'Yes');
    case 'license':
      return item.flags.license;
    case 'country':
      return '';
    default:
      return '';
  }
}

export interface CsvBuildResult {
  platform: PlatformId;
  filename: string;
  content: string;
  rows: number;
  bytes: number;
  warnings: string[];
}

export function buildPlatformCsv(
  items: StockItem[],
  platformId: PlatformId,
  opts: { includeOptionalColumns?: boolean } = {},
): CsvBuildResult {
  const platform = PLATFORMS[platformId];
  const warnings: string[] = [];

  // Platforms without a CSV importer get a generic copy-paste sheet.
  const columns =
    platform.csv && opts.includeOptionalColumns !== false
      ? platform.csv.columns
      : platform.csv
        ? platform.csv.columns.slice(0, 4)
        : ['Filename', 'Title', 'Description', 'Keywords'];

  const spec: PlatformSpec = platform.csv
    ? platform
    : {
        ...platform,
        csv: { delimiter: ',', quote: '"', withHeader: true, columns, keywordJoin: ', ', notes: '' },
      };

  const lines: string[] = [];
  if (spec.csv!.withHeader) lines.push(columns.join(spec.csv!.delimiter));

  for (const item of items) {
    lines.push(columns.map((column) => field(columnValue(column, item, spec), spec)).join(spec.csv!.delimiter));
  }

  const content = `${lines.join('\r\n')}\r\n`;
  const bytes = new TextEncoder().encode(content).length;

  if (platform.id === 'adobe') {
    if (items.length > 5000) warnings.push('Adobe Stock accepts at most 5,000 rows per CSV.');
    if (bytes > 1_000_000) warnings.push('Adobe Stock CSV must be ≤ 1 MB — split the batch.');
    for (const item of items) {
      if (item.name.length > 30) warnings.push(`"${item.name}" exceeds Adobe's 30-char filename limit.`);
    }
  }
  if (platform.id === 'freepik' && items.some((i) => i.metadata.title.length > 100)) {
    warnings.push('Freepik titles are capped at 100 characters (truncated in export).');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    platform: platformId,
    filename: `${platformId}-metadata-${stamp}.csv`,
    content,
    rows: items.length,
    bytes,
    warnings,
  };
}

/** UTF-8 BOM helps Excel open comma/semicolon files without mangling text. */
export function withBom(content: string): string {
  return `\uFEFF${content}`;
}
