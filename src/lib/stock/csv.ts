import { ADOBE_CATEGORIES, PLATFORMS, SHUTTERSTOCK_CATEGORIES, type PlatformSpec } from './platforms';
import type { PlatformId, StockItem } from './types';

/**
 * Neutralise spreadsheet formulas.
 *
 * Titles, keywords and descriptions come from the file or an AI model, and a
 * cell that begins with =, +, @, a tab or a carriage return is executed by
 * Excel and Sheets on open. Leading numbers such as -0.5 stay untouched.
 */
function neutralizeFormula(value: string): string {
  if (/^[=+@\t\r]/.test(value) || /^-(?!\d+(\.\d+)?$)/.test(value)) return `'${value}`;
  return value;
}

function escapeCell(raw: string, delimiter: string): string {
  const cleaned = neutralizeFormula(raw.replace(/\r?\n/g, ' ').replace(/[\t\r]/g, ' ').trim());
  const needsQuotes = cleaned.includes(delimiter) || cleaned.includes('"') || cleaned.includes('\n');
  if (!needsQuotes) return cleaned;
  return `"${cleaned.replace(/"/g, '""')}"`;
}

function cleanKeyword(word: string, platform: PlatformSpec): string {
  let out = word.trim().toLowerCase().replace(/\s+/g, ' ');
  if (platform.id === 'vecteezy') out = out.replace(/[^a-z0-9 ]/g, '');
  if (platform.id === 'pond5') out = out.replace(/"/g, '');
  return out.trim();
}

export function keywordsFor(item: StockItem, platform: PlatformSpec): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of item.metadata.keywords) {
    const clean = cleanKeyword(word, platform);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= platform.keywords.max) break;
  }
  return out;
}

function clamp(text: string, max: number): string {
  const clean = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd();
}

const yesNo = (flag: boolean) => (flag ? 'yes' : 'no');

function matchAdobeCategory(categories: string[]): string {
  for (const candidate of categories) {
    if (ADOBE_CATEGORIES[candidate]) return String(ADOBE_CATEGORIES[candidate]);
    const hit = Object.entries(ADOBE_CATEGORIES).find(([name]) =>
      name.toLowerCase().includes(candidate.toLowerCase()),
    );
    if (hit) return String(hit[1]);
  }
  return '';
}

function matchShutterstockCategories(categories: string[]): string {
  const out: string[] = [];
  for (const candidate of categories) {
    const exact = SHUTTERSTOCK_CATEGORIES.find((c) => c.toLowerCase() === candidate.toLowerCase());
    if (exact && !out.includes(exact)) out.push(exact);
    else {
      const partial = SHUTTERSTOCK_CATEGORIES.find((c) =>
        c.toLowerCase().includes(candidate.toLowerCase()),
      );
      if (partial && !out.includes(partial)) out.push(partial);
    }
    if (out.length >= 2) break;
  }
  return out.join(',');
}

function rowFor(item: StockItem, platform: PlatformSpec, releaseNames: string[] = []): string[] | null {
  const csv = platform.csv;
  if (!csv) return null;
  const kw = keywordsFor(item, platform).join(csv.keywordJoin);
  const title = clamp(
    platform.title.noCommas ? item.metadata.title.replace(/,/g, '') : item.metadata.title,
    platform.title.maxChars,
  );
  const desc = clamp(item.metadata.description || item.metadata.title, platform.description.maxChars);

  switch (platform.id) {
    case 'shutterstock':
      return [
        item.name,
        desc,
        kw,
        matchShutterstockCategories(item.metadata.categories),
        yesNo(item.flags.editorial),
        yesNo(item.flags.mature),
        yesNo(item.flags.illustration || item.format === 'eps'),
      ];
    case 'adobe':
      return [
        item.name,
        title,
        kw,
        matchAdobeCategory(item.metadata.categories),
        releaseNames.join(', '),
      ];
    case 'freepik': {
      const prompt = item.flags.aiGenerated ? clamp(item.flags.aiPrompt || desc, 500) : '';
      const model = item.flags.aiGenerated ? clamp(item.flags.aiTool || 'Generative AI', 80) : '';
      return [item.name, title, `"${kw}"`, prompt, model];
    }
    case 'dreamstime': {
      const [c1 = '', c2 = '', c3 = ''] = item.metadata.categories;
      const distinct =
        desc.toLowerCase() === title.toLowerCase() && desc ? `${desc} Commercial stock image.` : desc;
      return [
        item.name,
        title,
        clamp(distinct, platform.description.maxChars),
        c1,
        c2,
        c3,
        kw,
        '0',
        '1',
        '1',
        '0',
        '',
        item.flags.editorial ? '1' : '0',
        releaseNames.join(','),
        '',
      ];
    }
    case '123rf':
      return [item.name, '', desc, kw, ''];
    case 'depositphotos':
      return [item.name, desc, kw, yesNo(item.flags.mature), yesNo(item.flags.editorial)];
    case 'vecteezy':
      return [item.name, title, desc, `"${kw}"`, item.flags.editorial ? 'editorial' : item.flags.license];
    case 'pond5':
      return [
        item.name,
        title.replace(/"/g, ''),
        desc.replace(/"/g, ''),
        kw,
        item.metadata.categories[0] ?? '',
        yesNo(item.flags.editorial),
        '',
      ];
    case 'canva':
      return [item.name, title, desc, kw, 'en'];
    default:
      return null;
  }
}

export interface GeneratedCsv {
  platformId: PlatformId;
  filename: string;
  content: string;
  rowCount: number;
  skipped: Array<{ item: StockItem; reason: string }>;
  chunks: Array<{ filename: string; content: string; rowCount: number }>;
}

/** Generate a marketplace ready CSV file with exact column order and encoding. */
export function generateCsv(
  platformId: PlatformId,
  items: StockItem[],
  releasesFor?: (item: StockItem) => string[],
): GeneratedCsv {
  const platform = PLATFORMS[platformId];
  const csv = platform.csv;
  if (!csv) {
    throw new Error(`${platform.name} uses embedded IPTC and XMP metadata instead of CSV.`);
  }

  const skipped: GeneratedCsv['skipped'] = [];
  const dataLines: string[] = [];

  for (const item of items) {
    if (item.flags.aiGenerated && platform.aiPolicy === 'forbidden') {
      skipped.push({ item, reason: `${platform.name} does not accept AI generated content` });
      continue;
    }
    const row = rowFor(item, platform, releasesFor?.(item) ?? []);
    if (!row) continue;
    const line = row
      .map((cell) => {
        if (cell.startsWith('"') && cell.endsWith('"') && !cell.slice(1, -1).includes('"')) return cell;
        return escapeCell(cell, csv.delimiter);
      })
      .join(csv.delimiter);
    dataLines.push(line);
  }

  const BOM = '\uFEFF';
  const header = csv.withHeader
    ? `${csv.columns.map((c) => escapeCell(c, csv.delimiter)).join(csv.delimiter)}\r\n`
    : '';
  const body = dataLines.join('\r\n');
  const full = BOM + header + body + (body ? '\r\n' : '');

  const date = new Date().toISOString().slice(0, 10);
  const baseName = `${platform.id}_metadata_${date}`;

  const chunks: GeneratedCsv['chunks'] = [];
  if (csv.maxRows || csv.maxBytes) {
    const maxRows = csv.maxRows ?? Infinity;
    const maxBytes = csv.maxBytes ?? Infinity;
    let bucket: string[] = [];
    let size = header.length + 3;
    const flush = () => {
      if (!bucket.length) return;
      const idx = chunks.length + 1;
      chunks.push({
        filename: `${baseName}_part${idx}.csv`,
        content: BOM + header + bucket.join('\r\n') + '\r\n',
        rowCount: bucket.length,
      });
      bucket = [];
      size = header.length + 3;
    };
    for (const line of dataLines) {
      const next = size + line.length + 2;
      if (bucket.length >= maxRows || (bucket.length > 0 && next > maxBytes)) flush();
      bucket.push(line);
      size += line.length + 2;
    }
    flush();
  }

  if (chunks.length <= 1) {
    const single = { filename: `${baseName}.csv`, content: full, rowCount: dataLines.length };
    return {
      platformId,
      ...single,
      skipped,
      chunks: [single],
    };
  }

  return {
    platformId,
    filename: `${baseName}.csv`,
    content: full,
    rowCount: dataLines.length,
    skipped,
    chunks,
  };
}

/** Generate a universal portable CSV covering every selected item. */
export function generateUniversalCsv(items: StockItem[]): { filename: string; content: string; rowCount: number } {
  const BOM = '\uFEFF';
  const header = 'Filename,Title,Description,Keywords,Categories,AI Generated,Editorial\r\n';
  const lines = items.map((item) => {
    const cells = [
      item.name,
      clamp(item.metadata.title, 200),
      clamp(item.metadata.description || item.metadata.title, 2048),
      item.metadata.keywords.join(', '),
      item.metadata.categories.join(', '),
      item.flags.aiGenerated ? 'yes' : 'no',
      item.flags.editorial ? 'yes' : 'no',
    ];
    return cells.map((c) => escapeCell(c, ',')).join(',');
  });
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `stock_metadata_${date}.csv`,
    content: BOM + header + lines.join('\r\n') + (lines.length ? '\r\n' : ''),
    rowCount: lines.length,
  };
}
