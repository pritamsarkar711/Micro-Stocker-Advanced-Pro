import clsx from 'clsx';
import { COIN_BRANDS } from '@/lib/pro/brands';

/** Maps a payment asset to its official coin mark. */
const ASSET_MARK: Record<string, string> = {
  btc: 'btc',
  usdt: 'usdt',
  usdc: 'usdc',
  bnb: 'bnb',
  sol: 'sol',
  ltc: 'ltc',
  dai: 'dai',
  trx: 'trx',
  matic: 'matic',
};

export function CoinMark({ asset, size = 24, className }: { asset: string; size?: number; className?: string }) {
  const prefix = asset.split('-')[0];
  const brand = COIN_BRANDS[ASSET_MARK[prefix] ?? prefix] ?? null;
  if (!brand) return null;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={brand.name}
      className={clsx('shrink-0', className)}
      dangerouslySetInnerHTML={{ __html: brand.svg }}
    />
  );
}

/** Resolves the ticker used by an invoice to a coin key. */
export function coinKeyForAsset(assetId: string): string | null {
  const prefix = assetId.split('-')[0];
  return ASSET_MARK[prefix] ?? null;
}

/**
 * bKash and Nagad brand marks.
 *
 * Drawn from each brand's published artwork: bKash's pink field and white
 * origami bird beside the two-tone wordmark, Nagad's orange arc above the red
 * wordmark. These identify the payment method only; no generic wallet glyph is
 * used anywhere in the checkout.
 */
export function PaymentMark({ method, size = 28, className }: { method: 'bkash' | 'nagad'; size?: number; className?: string }) {
  if (method === 'bkash') {
    return (
      <svg viewBox="0 0 100 28" width={size * 3.6} height={size} role="img" aria-label="bKash" className={className}>
        <rect width="28" height="28" rx="6" fill="#E2136E" />
        <path d="M8 18.6 15.2 8.4l1.8 5.5 4-2.1-3.2 6.9-4 1.4-1.5-3.3-2 3.7z" fill="#fff" />
        <path d="M10 19.2 16 12.9l1.2 3.8z" fill="#E2136E" />
        <text x="34" y="20" fontFamily="Inter, system-ui, sans-serif" fontSize="17" fontWeight="700" fill="#E2136E">bK</text>
        <text x="63" y="20" fontFamily="Inter, system-ui, sans-serif" fontSize="17" fontWeight="700" fill="#231F20">ash</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 28" width={size * 3.6} height={size} role="img" aria-label="Nagad" className={className}>
      <defs>
        <linearGradient id="nagad-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EE1C25" />
          <stop offset="100%" stopColor="#F58220" />
        </linearGradient>
      </defs>
      <path d="M9 8.5c6-4.6 15-4.6 21 0" stroke="url(#nagad-mark)" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <text x="6" y="24" fontFamily="Inter, system-ui, sans-serif" fontSize="19" fontWeight="800" fill="url(#nagad-mark)">nagad</text>
    </svg>
  );
}
