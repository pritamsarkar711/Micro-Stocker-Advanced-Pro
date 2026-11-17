import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border border-line',
  brand: 'bg-brand-soft text-brand-fg',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-surface-3 text-fg-muted',
  danger: 'bg-danger-soft text-danger',
  outline: 'border border-line-strong bg-surface text-fg-muted',
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
        'inline-flex items-center gap-1.5 font-medium whitespace-nowrap r-chip',
        size === 'sm' ? 'px-2 py-0.5 text-[0.75rem]' : 'px-2.5 py-1 text-[0.8125rem]',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-85" />}
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
        ? 'bg-brand animate-pulse'
        : state === 'error'
          ? 'bg-danger'
          : 'bg-fg-subtle';
  return <span className={clsx('inline-block size-2 rounded-full', color, className)} />;
}
