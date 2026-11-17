import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
}

const PAD = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export function Card({ padding = 'md', interactive, className, title, description, action, flush, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'card',
        PAD[flush ? 'none' : padding],
        interactive && 'card-hover cursor-pointer',
        className,
      )}
      {...rest}
    >
      {title && <CardHeader title={title} subtitle={description} action={action} className={flush ? 'px-4 pt-4' : undefined} />}
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('mb-4 flex flex-wrap items-start justify-between gap-2.5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-brand-soft text-brand">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] leading-snug font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[0.75rem] text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
