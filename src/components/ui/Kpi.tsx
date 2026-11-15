import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface KpiProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Short qualifier, e.g. "of 240". Keep to a few characters. */
  unit?: string;
  trend?: number;
  tone?: 'default' | 'brand' | 'ok' | 'warn' | 'danger';
  to?: string;
}

const ICON_TONE: Record<NonNullable<KpiProps['tone']>, string> = {
  default: 'bg-surface-3 text-fg-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

/**
 * KPI tile: tonal icon chip, tabular figure, one-word label. No prose.
 */
export function Kpi({ label, value, icon: Icon, unit, trend, tone = 'default', to }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center r-control bg-surface-2 text-fg-muted transition-colors group-hover:bg-surface-3">
          <Icon className="size-[1.1rem]" strokeWidth={2} />
        </span>
        {trend !== undefined ? (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 r-chip px-1.5 py-0.5 text-[0.6875rem] font-semibold',
              trend >= 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
            )}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(trend).toFixed(0)}%
          </span>
        ) : (
          <span
            className={clsx(
              'flex size-7 items-center justify-center rounded-full',
              ICON_TONE[tone].split(' ')[0],
            )}
            aria-hidden="true"
          >
            <span className={clsx('size-1.5 rounded-full bg-current', ICON_TONE[tone].split(' ')[1])} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="nums display text-[1.625rem] leading-none font-extrabold tracking-[-0.03em] text-fg">
          {value}
        </span>
        {unit && <span className="text-[0.75rem] font-medium text-fg-subtle">{unit}</span>}
      </div>
      <span className="mt-1.5 block truncate text-[0.75rem] font-medium text-fg-muted">{label}</span>
    </>
  );

  const cls = clsx(
    'card group block px-4 py-3.5 transition-[border-color,box-shadow] duration-150',
    to && 'hover:border-line-strong hover:shadow-[var(--elev-2)]',
  );

  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
