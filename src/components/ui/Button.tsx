import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-hover active:translate-y-px shadow-[0_1px_2px_rgba(0,0,0,0.16)]',
  secondary: 'bg-surface-3 text-fg hover:bg-line active:translate-y-px',
  outline: 'border border-line-strong bg-transparent text-fg hover:bg-surface-2 active:translate-y-px',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-3 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110 active:translate-y-px',
  success: 'bg-ok text-white hover:brightness-110 active:translate-y-px',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 px-2.5 text-xs rounded-md',
  sm: 'h-9 gap-1.5 px-3 text-sm rounded-lg',
  md: 'h-11 gap-2 px-4 text-sm rounded-lg sm:h-10',
  lg: 'h-12 gap-2 px-5 text-base rounded-xl',
  icon: 'size-11 rounded-lg sm:size-10',
  'icon-sm': 'size-8 rounded-md',
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
        'inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,transform,box-shadow] duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}
