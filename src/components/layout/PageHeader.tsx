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
    <div className={clsx('flex flex-col gap-4 pb-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl lg:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-fg-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
