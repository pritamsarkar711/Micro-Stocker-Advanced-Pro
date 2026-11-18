import type { FlagCode } from '@/components/ui/CircleFlag';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'BDT' | 'INR' | 'SGD' | 'CAD' | 'AUD' | 'JPY';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  flag: FlagCode;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', flag: 'us' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', flag: 'eu' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', flag: 'gb' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'en-BD', flag: 'bd' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', flag: 'in' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', flag: 'sg' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', flag: 'ca' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', flag: 'au' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', flag: 'jp' },
];

export function currencyMeta(code: CurrencyCode): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function money(value: number, currency: CurrencyCode = 'USD', decimals = 2): string {
  const meta = currencyMeta(currency);
  const places = currency === 'JPY' ? 0 : decimals;
  if (!Number.isFinite(value)) return `${meta.symbol}0`;
  const formatted = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(value);
  return `${meta.symbol}${formatted}`;
}

let takaGlyph: boolean | null = null;

/**
 * Not every system ships a Bengali font, and a missing glyph turns ৳1,590 into
 * "b1,590". Detect it once and fall back to the plain BDT prefix.
 */
export function takaGlyphAvailable(): boolean {
  if (takaGlyph !== null) return takaGlyph;
  if (typeof document === 'undefined') return true;
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return (takaGlyph = true);
    context.font = '32px sans-serif';
    const sign = context.measureText('৳').width;
    const missing = context.measureText('\u{10FFFF}').width;
    takaGlyph = sign > 0 && Math.abs(sign - missing) > 0.5;
  } catch {
    takaGlyph = true;
  }
  return takaGlyph;
}

/** The currency mark alone, for column headers and labels. */
export function bdtUnit(): string {
  return takaGlyphAvailable() ? '৳' : 'BDT';
}

/** Money in Bangladeshi taka, the only currency the plans are sold in. */
export function bdt(value: number, decimals = 0): string {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
  return takaGlyphAvailable() ? `৳${formatted}` : `BDT ${formatted}`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function number(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function dateTime(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function date(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
