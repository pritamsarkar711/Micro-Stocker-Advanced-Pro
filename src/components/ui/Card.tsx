import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  /** Rarely needed: captions add noise. Kept for dense reference tables. */
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  padded?: boolean;
  flush?: boolean;
}

export function Card({
  title,
  description,
  action,
  icon,
  padded = true,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section className={clsx('card overflow-hidden', className)} {...rest}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-fg-subtle">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-[0.8125rem] font-semibold tracking-tight text-fg">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 truncate text-[0.75rem] text-fg-muted">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
        </header>
      )}
      <div className={clsx(!flush && padded && 'p-3.5')}>{children}</div>
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
    <div className={clsx('flex items-baseline justify-between gap-2', className)}>
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-fg-subtle uppercase">
        {children}
      </h2>
      {hint && <span className="text-[0.6875rem] text-fg-subtle">{hint}</span>}
    </div>
  );
}
