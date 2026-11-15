/** Formatting helpers. Currency defaults to BDT but is configurable. */

export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'GBP' | 'INR';

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  BDT: 'en-BD',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  INR: 'en-IN',
};

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export function money(value: number, currency: CurrencyCode = 'BDT', decimals = 2): string {
  if (!Number.isFinite(value)) return `${CURRENCY_SYMBOL[currency]}0.00`;
  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
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
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(iso: string | number | Date): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = d - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === 'second') {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(0, 'second');
}

export function percent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(decimals)}%`;
}

export function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
