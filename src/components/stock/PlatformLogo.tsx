import clsx from 'clsx';
import { PLATFORM_BRAND } from '@/lib/stock/brand';
import { platformName } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';

export interface PlatformLogoProps {
  id: PlatformId;
  /** Tile edge in px. */
  size?: number;
  /** Render only the glyph, painted in the brand colour (no tile). */
  bare?: boolean;
  className?: string;
  title?: string;
}

/**
 * Marketplace brand mark: official glyph (simple-icons, CC0) or a monogram in
 * the brand colour, drawn as a crisp inline SVG so it stays sharp at any DPI.
 */
export function PlatformLogo({ id, size = 22, bare = false, className, title }: PlatformLogoProps) {
  const brand = PLATFORM_BRAND[id];
  const label = title ?? platformName(id);

  if (!brand) return null;

  if (bare) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label={label}
        className={clsx('shrink-0', className)}
        style={{ color: brand.color }}
      >
        {brand.glyph ? (
          <path d={brand.glyph} fill="currentColor" />
        ) : (
          <text
            x="12"
            y="17"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="var(--font-sans)"
            fontWeight="800"
            fontSize={(brand.monogram ?? 'A').length > 1 ? 9 : 14}
          >
            {brand.monogram}
          </text>
        )}
      </svg>
    );
  }

  const mono = brand.monogram ?? '';
  const fontSize = mono.length > 2 ? size * 0.3 : mono.length === 2 ? size * 0.38 : size * 0.52;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] text-white',
        'ring-1 ring-black/10 ring-inset',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, color-mix(in oklab, ${brand.color} 88%, white 12%), ${brand.color} 45%, color-mix(in oklab, ${brand.color} 76%, black 24%))`,
        boxShadow: `0 2px 8px -3px ${brand.color}aa`,
      }}
    >
      {brand.glyph ? (
        <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} aria-hidden="true">
          <path d={brand.glyph} fill="currentColor" />
        </svg>
      ) : (
        <span
          aria-hidden="true"
          className="font-extrabold tracking-tight"
          style={{ fontSize, lineHeight: 1, letterSpacing: mono.length > 2 ? '-0.04em' : undefined }}
        >
          {mono}
        </span>
      )}
      {/* glossy highlight so tiles read as product marks, not flat dots */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 46%)' }}
      />
    </span>
  );
}

/** Row of every supported marketplace mark (used on Overview + Platforms). */
export function PlatformLogoRow({
  ids,
  size = 20,
  className,
}: {
  ids: PlatformId[];
  size?: number;
  className?: string;
}) {
  return (
    <span className={clsx('flex items-center', className)}>
      {ids.map((id, index) => (
        <PlatformLogo
          key={id}
          id={id}
          size={size}
          className={clsx(index > 0 && '-ml-1.5 ring-2 ring-surface')}
        />
      ))}
    </span>
  );
}
