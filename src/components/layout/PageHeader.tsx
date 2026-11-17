import clsx from 'clsx';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}) {
  return (
    <div className={clsx('mb-5 flex flex-col gap-3.5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-2xs font-semibold tracking-[0.14em] text-brand-fg uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="display text-[1.5rem] leading-tight font-bold tracking-[-0.018em] text-ink sm:text-[1.625rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
