import clsx from 'clsx';
import { COIN_BRANDS } from '@/lib/pro/brands';
import bkashLogo from '@/assets/brand/bkash.png';
import nagadLogo from '@/assets/brand/nagad.png';

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
 * Official artwork, trimmed and served from the bundle so the checkout shows the
 * real wordmarks rather than a redrawn approximation. Both are rendered on a
 * white chip because the marks are designed for light surfaces.
 */
export function PaymentMark({ method, size = 28, className }: { method: 'bkash' | 'nagad'; size?: number; className?: string }) {
  const mark = method === 'bkash'
    ? { src: bkashLogo, label: 'bKash' }
    : { src: nagadLogo, label: 'Nagad' };
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/5', className)}
      style={{ height: size, width: size * 2.3 }}
    >
      <img
        src={mark.src}
        alt={mark.label}
        draggable={false}
        className="max-h-[62%] max-w-[74%] object-contain"
      />
    </span>
  );
}
