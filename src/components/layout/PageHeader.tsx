import clsx from 'clsx';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-4 flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="display truncate text-[1.4375rem] leading-tight font-extrabold tracking-[-0.02em] text-fg">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="no-scrollbar flex shrink-0 flex-wrap items-center gap-1.5">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
