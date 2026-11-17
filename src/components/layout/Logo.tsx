import clsx from 'clsx';

export interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  tone?: 'default' | 'onDark';
}

/**
 * Micro Stocker mark: a flat pink tile with a white capture monogram.
 * No gradients, no glows — it stays crisp from 16px to 512px and matches the
 * application icon down to the corner radius.
 */
export function LogoMark({
  size = 32,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  /** True next to the wordmark, where the name is already read out. */
  decorative?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Micro Stocker'}
      aria-hidden={decorative ? true : undefined}
      className={clsx('shrink-0', className)}
    >
      <rect width="48" height="48" rx="9" fill="var(--brand)" />
      <path
        d="M12.75 34V17.6c0-1.6 1.9-2.4 3-1.2L24 25.6l8.25-9.2c1.1-1.2 3-0.4 3 1.2V34"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35.25" cy="12.75" r="2.6" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ size = 32, showWordmark = false, className, tone = 'default' }: LogoProps) {
  return (
    <span className={clsx('inline-flex min-w-0 items-center gap-2.5 select-none', className)}>
      <LogoMark size={size} decorative={showWordmark} />
      {showWordmark && (
        <span className="min-w-0 leading-none">
          <span
            className={clsx(
              'block truncate text-[0.9375rem] font-bold tracking-[-0.01em]',
              tone === 'onDark' ? 'text-nav-fg-strong' : 'text-ink',
            )}
          >
            Micro Stocker
          </span>
          <span
            className={clsx(
              'mt-1 block truncate text-2xs font-medium tracking-[0.16em] uppercase',
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
