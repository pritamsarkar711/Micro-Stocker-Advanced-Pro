import clsx from 'clsx';
import { PLATFORM_BRAND } from '@/lib/stock/brand';
import { platformName } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';

export interface PlatformLogoProps {
  id: PlatformId;
  /** Tile edge in px. */
  size?: number;
  /** Bare glyph instead of the rounded brand tile. */
  bare?: boolean;
  className?: string;
  title?: string;
}

/**
 * Marketplace mark: the official simple-icons glyph (CC0) recoloured to the
 * brand's primary colour, or a wordmark monogram where no open glyph exists.
 * Kept flat and square-ish so it reads as a product mark, not a sticker.
 */
export function PlatformLogo({ id, size = 20, bare = false, className, title }: PlatformLogoProps) {
  const brand = PLATFORM_BRAND[id];
  const label = title ?? platformName(id);
  if (!brand) return null;

  const glyph = brand.glyph && (
    <svg
      viewBox="0 0 24 24"
      width={bare ? size : size * 0.74}
      height={bare ? size : size * 0.74}
      role="img"
      aria-label={label}
      focusable="false"
    >
      <g
        fill="currentColor"
        // Official multicolour marks paint themselves; single-colour marks
        // inherit the icon colour so tiles stay consistent in the UI.
        style={brand.multicolor ? undefined : { color: brand.color }}
      >
        <g dangerouslySetInnerHTML={{ __html: brand.glyph }} />
      </g>
    </svg>
  );

  const mono = brand.monogram ?? '';
  const text = (
    <span
      aria-hidden="true"
      className="font-bold tracking-tight"
      style={{ fontSize: size * (mono.length > 2 ? 0.3 : mono.length === 2 ? 0.38 : 0.5), lineHeight: 1 }}
    >
      {mono}
    </span>
  );

  if (bare) {
    return (
      <span
        className={clsx('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size, color: brand.color }}
        title={label}
      >
        {brand.glyph ? glyph : text}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden r-chip',
        'border border-line bg-surface-2',
        className,
      )}
      style={{ width: size, height: size, color: brand.glyph ? undefined : brand.color }}
    >
      {brand.glyph ? glyph : <span style={{ color: brand.color }}>{text}</span>}
    </span>
  );
}

/** Overlapping mark row, used where space is tight (tables, headers). */
export function PlatformLogoRow({
  ids,
  size = 18,
  className,
}: {
  ids: PlatformId[];
  size?: number;
  className?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center', className)}>
      {ids.map((id, index) => (
        <PlatformLogo
          key={id}
          id={id}
          size={size}
          className={clsx(index > 0 && '-ml-1 ring-2 ring-surface')}
        />
      ))}
    </span>
  );
}
