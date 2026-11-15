import clsx from 'clsx';
import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  delta?: number;
  deltaLabel?: string;
  hint?: ReactNode;
  tone?: 'default' | 'brand' | 'ok' | 'warn' | 'danger';
  className?: string;
}

const TONE_RING: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-fg-muted bg-surface-3',
  brand: 'text-brand-fg bg-brand-soft',
  ok: 'text-ok bg-ok-soft',
  warn: 'text-warn bg-warn-soft',
  danger: 'text-danger bg-danger-soft',
};

export function StatCard({
  label,
  value,
  icon,
  delta,
  deltaLabel,
  hint,
  tone = 'default',
  className,
}: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <article
      className={clsx(
        'card flex flex-col gap-3 p-4 transition hover:border-line-strong sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase sm:text-[0.8125rem]">
          {label}
        </p>
        {icon && (
          <span
            className={clsx(
              'flex size-9 shrink-0 items-center justify-center rounded-xl',
              TONE_RING[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight text-fg tabular-nums sm:text-3xl">
          {value}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta !== undefined && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold',
                up ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
              )}
            >
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {deltaLabel && <span className="text-xs text-fg-subtle">{deltaLabel}</span>}
        </div>
        {hint && <p className="mt-2 text-xs leading-relaxed text-fg-muted">{hint}</p>}
      </div>
    </article>
  );
}
