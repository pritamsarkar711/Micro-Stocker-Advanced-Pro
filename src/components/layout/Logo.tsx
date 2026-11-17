import clsx from 'clsx';

export interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 28, showWordmark = false, className }: LogoProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-[6px] bg-accent text-on-brand shadow-xs"
        style={{ width: size, height: size }}
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="8" height="8" rx="1.6" fill="currentColor" />
          <rect x="13" y="3" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.72" />
          <rect x="3" y="13" width="8" height="8" rx="1.6" fill="currentColor" opacity="0.72" />
          <circle cx="17" cy="17" r="4" fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-bold tracking-tight text-ink">
            Micro Stocker
          </span>
          <span className="block truncate text-[10px] font-medium text-ink-muted">
            Advanced Pro
          </span>
        </span>
      )}
    </span>
  );
}
