import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { GIcon, type GoogleIconName } from './GoogleIcon';

export interface KpiProps {
  label: string;
  value: string | number;
  icon: GoogleIconName;
  unit?: string;
  trend?: number;
  tone?: 'default' | 'brand' | 'ok' | 'warn' | 'danger';
  to?: string;
}

const ICON_BOX: Record<NonNullable<KpiProps['tone']>, string> = {
  default: 'bg-surface-2 text-fg-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-surface-2 text-fg-muted',
  danger: 'bg-danger-soft text-danger',
};

export function Kpi({ label, value, icon, unit, trend, tone = 'default', to }: KpiProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.8125rem] font-semibold text-fg-muted">{label}</span>
        <span
          className={clsx(
            'flex size-9 shrink-0 items-center justify-center r-control',
            ICON_BOX[tone],
          )}
        >
          <GIcon name={icon} size={19} />
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="nums display text-[1.75rem] leading-none font-bold tracking-[-0.02em] text-fg">
          {value}
        </span>
        {unit && <span className="text-[0.8125rem] font-medium text-fg-subtle">{unit}</span>}
        {trend !== undefined && (
          <span
            className={clsx(
              'ml-auto inline-flex items-center gap-0.5 r-chip px-1.5 py-0.5 text-2xs font-semibold',
              trend >= 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
            )}
          >
            <GIcon name={trend >= 0 ? 'north_east' : 'south_east'} size={12} />
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
    </>
  );

  const cls = clsx(
    'card group block px-4 py-4 transition-[border-color,box-shadow] duration-150',
    to && 'hover:border-brand/40 hover:shadow-[var(--elev-2)]',
  );

  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
