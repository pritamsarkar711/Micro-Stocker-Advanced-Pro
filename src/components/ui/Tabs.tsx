import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

/**
 * Horizontally scrollable tab strip - never wraps awkwardly on narrow windows.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        'no-scrollbar flex gap-3 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={clsx(
              'relative inline-flex shrink-0 items-center gap-1.5 py-2 text-[0.8125rem] font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'text-brand-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
            <span
              className={clsx(
                '-bottom-px absolute inset-x-0 h-[2px] rounded-full',
                active ? 'bg-brand opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
