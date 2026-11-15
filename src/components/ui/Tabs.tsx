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
        'no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1',
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
              'relative inline-flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium transition',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'text-brand-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
            <span
              className={clsx(
                'absolute inset-x-1 -bottom-px h-0.5 rounded-full transition-opacity',
                active ? 'bg-brand opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
