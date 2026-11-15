import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

/**
 * Material-style button scale. Heights step 28 → 44 so the same control works
 * in a table toolbar and in a dialog footer without looking out of place.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-[0_1px_2px_rgb(16_24_40/0.10)] hover:bg-brand-hover active:bg-brand-hover',
  secondary:
    'bg-brand-soft text-brand-fg hover:bg-brand/12 active:bg-brand/16',
  outline:
    'bg-surface text-fg border border-line-strong hover:bg-surface-2 hover:border-fg-subtle/50',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white shadow-[0_1px_2px_rgb(16_24_40/0.10)] hover:brightness-108',
  success: 'bg-ok text-white shadow-[0_1px_2px_rgb(16_24_40/0.10)] hover:brightness-108',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 px-2 text-[0.75rem]',
  sm: 'h-8 gap-1.5 px-2.5 text-[0.8125rem]',
  md: 'h-9 gap-2 px-3.5 text-[0.8125rem]',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'size-9',
  'icon-sm': 'size-8',
  'icon-lg': 'size-11',
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
        'transition-[background-color,box-shadow,color] duration-150 ease-[var(--ease-standard)]',
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
