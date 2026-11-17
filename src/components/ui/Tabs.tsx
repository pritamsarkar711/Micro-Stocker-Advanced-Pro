import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={clsx(
              'inline-flex h-9 items-center gap-2 rounded-[var(--r-chip)] px-3 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors',
              active
                ? 'bg-accent text-on-brand shadow-2xs'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={clsx(
                  'rounded-[3px] px-1 text-2xs tabular-nums',
                  active ? 'bg-white/20 text-accent-fg' : 'bg-surface text-ink-faint',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
