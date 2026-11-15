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

const TONE: Record<NonNullable<KpiProps['tone']>, string> = {
  default: 'text-fg-subtle',
  brand: 'text-brand',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

/**
 * Compact KPI tile: icon, big number, one-word label. No prose.
 */
export function Kpi({ label, value, icon: Icon, unit, trend, tone = 'default', to }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.6875rem] font-medium tracking-[0.06em] text-fg-subtle uppercase">
          {label}
        </span>
        <Icon className={clsx('size-[1.05rem] shrink-0', TONE[tone])} strokeWidth={2} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="nums text-[1.5rem] leading-none font-semibold text-fg">{value}</span>
        {unit && <span className="text-[0.6875rem] text-fg-subtle">{unit}</span>}
        {trend !== undefined && (
          <span
            className={clsx(
              'ml-auto inline-flex items-center gap-0.5 text-[0.6875rem] font-medium',
              trend >= 0 ? 'text-ok' : 'text-danger',
            )}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
    </>
  );

  const cls = clsx(
    'card block px-3.5 py-3 transition-colors',
    to && 'hover:border-line-strong',
  );

  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
