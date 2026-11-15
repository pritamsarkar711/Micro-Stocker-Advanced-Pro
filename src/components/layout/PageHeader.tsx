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
        'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-[1.0625rem] font-semibold tracking-tight text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 truncate text-[0.75rem] text-fg-muted">{description}</p>
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
