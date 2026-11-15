import type { PlatformId } from './types';

/**
 * Earnings analytics: parse each portal's sales/earnings CSV with automatic
 * column detection (headers differ between Shutterstock, Adobe, Freepik…),
 * normalise into one ledger, then aggregate.
 */

export interface Sale {
  id: string;
  platform: PlatformId | 'other';
  date: string; // yyyy-mm-dd
  title: string;
  earnings: number;
  downloads: number;
  license: string;
  country: string;
}

export interface ColumnMapping {
  date: string;
  title: string;
  earnings: string;
  downloads: string;
  license: string;
  country: string;
}

export const EMPTY_MAPPING: ColumnMapping = { date: '', title: '', earnings: '', downloads: '', license: '', country: '' };

const SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  date: ['date', 'download date', 'sale date', 'transaction date', 'day', 'sold on'],
  title: ['title', 'description', 'image title', 'content title', 'name', 'item'],
  earnings: ['earnings', 'earnings (usd)', 'usd earnings', 'royalty', 'royalties', 'amount', 'revenue', 'payment', 'commission'],
  downloads: ['downloads', 'download count', 'qty', 'quantity', 'units', 'sales count'],
  license: ['license', 'licence', 'license type', 'type', 'plan'],
  country: ['country', 'country code', 'region', 'buyer country'],
};

export function parseDelimited(text: string): { delimiter: string; headers: string[]; rows: string[][] } {
  const sample = text.slice(0, 4000);
  const counts: [string, number][] = [',', ';', '\t'].map((d) => [d, (sample.split('\n')[0]?.split(d).length ?? 0)]);
  counts.sort((a, b) => b[1] - a[1]);
  const delimiter = counts[0][1] > 1 ? counts[0][0] : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const push = () => {
    row.push(field);
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) push();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      push();
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  push();
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { delimiter, headers, rows };
}

export function detectMapping(headers: string[]): ColumnMapping {
  const mapping = { ...EMPTY_MAPPING };
  const lowered = headers.map((h) => h.toLowerCase().trim());
  (Object.keys(SYNONYMS) as (keyof ColumnMapping)[]).forEach((key) => {
    for (const synonym of SYNONYMS[key]) {
      const index = lowered.indexOf(synonym);
      if (index >= 0 && !Object.values(mapping).includes(headers[index])) {
        mapping[key] = headers[index];
        return;
      }
    }
    // fuzzy fallback
    if (!mapping[key]) {
      for (const synonym of SYNONYMS[key]) {
        const index = lowered.findIndex((h) => h.includes(synonym));
        if (index >= 0 && !Object.values(mapping).includes(headers[index])) {
          mapping[key] = headers[index];
          return;
        }
      }
    }
  });
  return mapping;
}

const toDate = (raw: string): string => {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
};

const toNumber = (raw: string): number => {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
};

export function mapRows(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  platform: PlatformId | 'other',
): Sale[] {
  const index = (column: string) => (column ? headers.indexOf(column) : -1);
  const iDate = index(mapping.date);
  const iTitle = index(mapping.title);
  const iEarn = index(mapping.earnings);
  const iDl = index(mapping.downloads);
  const iLic = index(mapping.license);
  const iCountry = index(mapping.country);

  return rows
    .map((row, n) => ({
      id: `${platform}-${n}-${row[iDate] ?? ''}-${row[iTitle] ?? ''}`,
      platform,
      date: iDate >= 0 ? toDate(row[iDate] ?? '') : '',
      title: iTitle >= 0 ? (row[iTitle] ?? '').trim() : '(untitled)',
      earnings: iEarn >= 0 ? toNumber(row[iEarn] ?? '') : 0,
      downloads: iDl >= 0 ? Math.max(1, toNumber(row[iDl] ?? '')) : 1,
      license: iLic >= 0 ? (row[iLic] ?? '').trim() : '',
      country: iCountry >= 0 ? (row[iCountry] ?? '').trim() : '',
    }))
    .filter((sale) => sale.date || sale.earnings > 0);
}

/* ------------------------------- aggregation ------------------------------- */

export function monthlySeries(sales: Sale[]): { month: string; earnings: number; downloads: number }[] {
  const map = new Map<string, { earnings: number; downloads: number }>();
  for (const sale of sales) {
    const month = sale.date.slice(0, 7) || 'unknown';
    const entry = map.get(month) ?? { earnings: 0, downloads: 0 };
    entry.earnings += sale.earnings;
    entry.downloads += sale.downloads;
    map.set(month, entry);
  }
  return Array.from(map.entries())
    .map(([month, value]) => ({ month, ...value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function platformTotals(sales: Sale[]): { platform: string; earnings: number; downloads: number }[] {
  const map = new Map<string, { earnings: number; downloads: number }>();
  for (const sale of sales) {
    const entry = map.get(sale.platform) ?? { earnings: 0, downloads: 0 };
    entry.earnings += sale.earnings;
    entry.downloads += sale.downloads;
    map.set(sale.platform, entry);
  }
  return Array.from(map.entries())
    .map(([platform, value]) => ({ platform, ...value }))
    .sort((a, b) => b.earnings - a.earnings);
}

export function topTitles(sales: Sale[], limit = 10): { title: string; earnings: number; downloads: number }[] {
  const map = new Map<string, { earnings: number; downloads: number }>();
  for (const sale of sales) {
    const entry = map.get(sale.title) ?? { earnings: 0, downloads: 0 };
    entry.earnings += sale.earnings;
    entry.downloads += sale.downloads;
    map.set(sale.title, entry);
  }
  return Array.from(map.entries())
    .map(([title, value]) => ({ title, ...value }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, limit);
}
