import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-fg-muted',
  brand: 'bg-brand-soft text-brand-fg',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  outline: 'border border-line-strong text-fg-muted',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({
  tone = 'neutral',
  dot = false,
  icon,
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {icon}
      {children}
    </span>
  );
}

export function StatusDot({
  state,
  className,
}: {
  state: 'online' | 'connecting' | 'error' | 'local';
  className?: string;
}) {
  const color =
    state === 'online'
      ? 'bg-ok'
      : state === 'connecting'
        ? 'bg-warn animate-pulse'
        : state === 'error'
          ? 'bg-danger'
          : 'bg-fg-subtle';
  return (
    <span className={clsx('relative inline-flex size-2', className)}>
      <span className={clsx('absolute inline-flex size-2 rounded-full opacity-60', color)} />
      <span className={clsx('relative inline-flex size-2 rounded-full', color)} />
    </span>
  );
}
