import clsx from 'clsx';
import { appName } from '@/lib/version';
import { isAndroid } from '@/lib/native/platform';

export interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  tone?: 'default' | 'onDark';
}

/**
 * Micro Stocker mark: a capture frame with a focus dot, drawn as flat shapes on
 * a pink tile. The four corner brackets stay legible down to 16 px, the centre
 * dot reads as an aperture, and the spark marks the AI assisted tools. No
 * gradients, no glows, so it matches the application icon exactly.
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
      aria-label={decorative ? undefined : appName()}
      aria-hidden={decorative ? true : undefined}
      className={clsx('shrink-0', className)}
    >
      <rect width="48" height="48" rx="11" fill="var(--brand)" />
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 19.5V14.6a1.6 1.6 0 0 1 1.6-1.6H19.5" />
        <path d="M28.5 13h4.9a1.6 1.6 0 0 1 1.6 1.6v4.9" />
        <path d="M35 28.5v4.9a1.6 1.6 0 0 1-1.6 1.6h-4.9" />
        <path d="M19.5 35h-4.9a1.6 1.6 0 0 1-1.6-1.6v-4.9" />
      </g>
      <circle cx="24" cy="24" r="5.6" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ size = 32, showWordmark = false, className, tone = 'default' }: LogoProps) {
  return (
    <span className={clsx('inline-flex min-w-0 items-center gap-2.5 select-none', className)}>
      <LogoMark size={size} decorative={showWordmark} />
      {showWordmark && (
        <span className="min-w-0 leading-none">
          {isAndroid() ? (
            <span
              className={clsx(
                'block truncate text-[0.9375rem] font-bold tracking-[-0.01em]',
                tone === 'onDark' ? 'text-nav-fg-strong' : 'text-ink',
              )}
            >
              {appName()}
            </span>
          ) : (
            <>
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
            </>
          )}
        </span>
      )}
    </span>
  );
}
