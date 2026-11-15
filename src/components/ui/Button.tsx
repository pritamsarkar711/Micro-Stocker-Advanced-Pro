import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-hover active:bg-brand-hover border border-transparent',
  secondary:
    'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
  outline:
    'bg-transparent text-fg border border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-fg-muted border border-transparent hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110 border border-transparent',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 px-2 text-[0.75rem]',
  sm: 'h-8 gap-1.5 px-2.5 text-[0.8125rem]',
  md: 'h-9 gap-2 px-3 text-sm',
  lg: 'h-10 gap-2 px-4 text-sm',
  icon: 'size-9',
  'icon-sm': 'size-7',
  'icon-lg': 'size-10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  block,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'r-control inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-120',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}
