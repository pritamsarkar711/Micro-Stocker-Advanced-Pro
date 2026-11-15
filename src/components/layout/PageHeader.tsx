import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Page title row. Deliberately captionless: the nav label and the page title
 * carry all the meaning; explanatory prose belongs in empty states only.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'mb-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="display truncate text-[1.375rem] leading-tight font-extrabold tracking-[-0.025em] text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-1 truncate text-[0.8125rem] text-fg-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
