import clsx from 'clsx';

/**
 * Product mark: an "M" cut from a single 5px stroke, with a half-opacity rule
 * underneath — the rule reads as a metadata caption line. Solid primary, no
 * gradient. Matches public/favicon.svg and the packaged app icon exactly.
 */
export function Logo({
  className,
  size = 28,
  withWordmark = false,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}) {
  const mark = (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center bg-brand text-white',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        style={{ width: size * 0.78, height: size * 0.78 }}
      >
        <path d="M14 47V17" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M14 18.5 32 38l18-19.5"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M50 47V17" strokeWidth="5" strokeLinecap="round" />
        <path d="M14 55h36" strokeWidth="4" strokeLinecap="round" opacity=".5" />
      </svg>
    </span>
  );

  if (!withWordmark) return mark;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {mark}
      <span className="min-w-0">
        <span className="display block truncate text-[0.875rem] leading-tight font-extrabold tracking-[-0.02em] text-fg">
          Micro Stocker
        </span>
        <span className="block truncate text-[0.625rem] leading-tight font-medium tracking-[0.06em] text-fg-subtle uppercase">
          Advanced Pro
        </span>
      </span>
    </span>
  );
}
