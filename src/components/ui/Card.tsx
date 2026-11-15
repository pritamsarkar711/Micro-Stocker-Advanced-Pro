import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
  flush?: boolean;
}

export function Card({
  title,
  description,
  action,
  padded = true,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section className={clsx('card overflow-hidden', className)} {...rest}>
      {(title || action) && (
        <header
          className={clsx(
            'flex flex-wrap items-center justify-between gap-3 border-b border-line',
            'px-4 py-3 sm:px-5',
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-sm font-semibold tracking-tight text-fg sm:text-base">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted sm:text-[0.8125rem]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={clsx(!flush && padded && 'p-4 sm:p-5')}>{children}</div>
    </section>
  );
}

export function SectionTitle({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-wrap items-baseline justify-between gap-2', className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">{children}</h3>
      {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
    </div>
  );
}
