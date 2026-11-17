import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { GIcon } from './GoogleIcon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-[0_1px_2px_rgb(15_23_42/0.14)] hover:bg-brand-hover active:scale-[0.99]',
  secondary:
    'bg-brand-soft text-brand-fg hover:brightness-97 dark:hover:brightness-110 active:scale-[0.99]',
  outline:
    'bg-surface text-fg border border-line-strong hover:bg-surface-2 hover:border-fg-subtle/60 active:scale-[0.99]',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger dark:bg-[#b42318] text-white shadow-[0_1px_2px_rgb(15_23_42/0.14)] hover:brightness-95 active:scale-[0.99]',
  success: 'bg-brand-solid text-white shadow-[0_1px_2px_rgb(15_23_42/0.14)] hover:brightness-95 active:scale-[0.99]',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-8 gap-1.5 px-2.5 text-[0.8125rem]',
  sm: 'h-9 gap-2 px-3.5 text-[0.8125rem]',
  md: 'h-10 gap-2 px-4 text-[0.875rem]',
  lg: 'h-12 gap-2.5 px-5 text-[0.9375rem]',
  icon: 'size-10',
  'icon-sm': 'size-9',
  'icon-lg': 'size-12',
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
        'r-control inline-flex shrink-0 cursor-pointer select-none items-center justify-center font-semibold whitespace-nowrap',
        'transition-[background-color,border-color,color,transform] duration-100 ease-[var(--ease-standard)]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <GIcon name="progress_activity" size={16} className="animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}
