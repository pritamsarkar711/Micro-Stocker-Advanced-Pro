import { useId } from 'react';
import clsx from 'clsx';

export interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  tone?: 'default' | 'onDark';
}

/**
 * Micro Stocker mark: a gradient "M" monogram with a capture spark,
 * drawn on a rounded Material-style tile. Renders crisply from 16px to 512px.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/[:]/g, '');
  const gid = `msap-g-${uid}`;
  const hid = `msap-h-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Micro Stocker"
      className={clsx('shrink-0', className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d43a63" />
          <stop offset="0.55" stopColor="#a02a63" />
          <stop offset="1" stopColor="#5326b8" />
        </linearGradient>
        <linearGradient id={hid} x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12.5" fill={`url(#${gid})`} />
      <rect width="48" height="48" rx="12.5" fill={`url(#${hid})`} />
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="11.9"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <path
        d="M13.5 34.5V17.2c0-2 2.3-3 3.7-1.6L24 23.1l6.8-7.5c1.4-1.4 3.7-0.4 3.7 1.6v17.3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M35.6 9.2l1.05 2.35 2.35 1.05-2.35 1.05L35.6 16l-1.05-2.35L32.2 12.6l2.35-1.05z" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ size = 32, showWordmark = false, className, tone = 'default' }: LogoProps) {
  return (
    <span className={clsx('inline-flex min-w-0 items-center gap-2.5 select-none', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span
            className={clsx(
              'block truncate text-[0.875rem] font-bold tracking-[-0.01em]',
              tone === 'onDark' ? 'text-nav-fg-strong' : 'text-ink',
            )}
          >
            Micro Stocker
          </span>
          <span
            className={clsx(
              'block truncate text-[0.6875rem] font-medium tracking-[0.14em] uppercase',
              tone === 'onDark' ? 'text-nav-fg-muted' : 'text-ink-faint',
            )}
          >
            Advanced Pro
          </span>
        </span>
      )}
    </span>
  );
}
