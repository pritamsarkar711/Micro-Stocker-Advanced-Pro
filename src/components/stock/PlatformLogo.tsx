import clsx from 'clsx';
import { PLATFORM_BRAND } from '@/lib/stock/brand';
import { platformName } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';

export interface PlatformLogoProps {
  id: PlatformId;
  size?: number;
  bare?: boolean;
  className?: string;
  title?: string;
}

/**
 * High definition official marketplace vector emblem.
 * Shutterstock, Adobe Stock and Magnific render in crisp full brand tiles at
 * slightly elevated scale for immediate visual recognition.
 */
export function PlatformLogo({ id, size = 24, bare = false, className, title }: PlatformLogoProps) {
  const brand = PLATFORM_BRAND[id];
  const label = title ?? platformName(id);
  if (!brand) return null;

  const tileSize = brand.featured ? Math.round(size * 1.18) : size;
  const isSolid = Boolean(brand.badgeBg && !bare);
  const glyphPx = bare ? tileSize : Math.round(tileSize * (isSolid ? 0.66 : 0.72));

  const glyph = brand.glyph && (
    <svg
      viewBox={brand.viewBox ?? '0 0 24 24'}
      width={glyphPx}
      height={glyphPx}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="currentColor"
        style={{ color: isSolid ? brand.badgeFg : brand.color }}
        dangerouslySetInnerHTML={{ __html: brand.glyph }}
      />
    </svg>
  );

  const mono = brand.monogram ?? '';
  const text = (
    <span
      aria-hidden="true"
      className="font-extrabold tracking-tight"
      style={{
        fontSize: Math.round(tileSize * (mono.length > 2 ? 0.34 : mono.length === 2 ? 0.42 : 0.56)),
        lineHeight: 1,
        color: brand.color,
      }}
    >
      {mono}
    </span>
  );

  if (bare) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={clsx('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: tileSize, height: tileSize }}
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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px]',
        isSolid
          ? 'shadow-[0_1px_2px_rgb(0_0_0/0.16)] ring-1 ring-black/8 dark:ring-white/12'
          : 'border border-line bg-surface',
        className,
      )}
      style={{
        width: tileSize,
        height: tileSize,
        backgroundColor: isSolid ? brand.badgeBg : undefined,
      }}
    >
      {brand.glyph ? glyph : text}
    </span>
  );
}

export function PlatformLogoRow({
  ids,
  size = 22,
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
