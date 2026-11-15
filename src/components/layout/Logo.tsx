import clsx from 'clsx';

/** Brand mark: stacked stock boxes + an upward arrow (pure SVG, no assets). */
export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center rounded-xl',
        'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white',
        'shadow-[0_6px_18px_-6px_rgba(99,102,241,0.9)]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 13.5 12 18l9-4.5" />
        <path d="M3 17.5 12 22l9-4.5" />
      </svg>
    </span>
  );
}
