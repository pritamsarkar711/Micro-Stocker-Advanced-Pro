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

/**
 * Elevated surface. Header is a 44px row with a hairline divider; body is
 * padded 16px so dense tables can opt out with `flush`.
 */
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
    <section className={clsx('card flex flex-col', className)} {...rest}>
      {(title || action) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-fg-subtle">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="display truncate text-[0.875rem] font-semibold text-fg">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 truncate text-[0.75rem] text-fg-muted">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
        </header>
      )}
      <div className={clsx(!flush && padded && 'p-4', 'min-w-0 flex-1')}>{children}</div>
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
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
        {children}
      </h2>
      {hint && <span className="text-[0.6875rem] text-fg-subtle">{hint}</span>}
    </div>
  );
}
