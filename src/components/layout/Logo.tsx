import clsx from 'clsx';

/**
 * Product mark: a single stroked glyph on the primary colour, no gradients.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center bg-brand text-white',
        'rounded-[0.4rem]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 12.5 12 17l9-4.5" />
        <path d="M3 17 12 21.5 21 17" />
      </svg>
    </span>
  );
}
