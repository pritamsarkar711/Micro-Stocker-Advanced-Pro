import clsx from 'clsx';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const CONTROL =
  'w-full rounded-[0.375rem] border bg-surface text-fg placeholder:text-fg-subtle transition-colors ' +
  'border-line hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-55';

const SIZES = {
  sm: 'h-8 px-2 text-[0.8125rem]',
  md: 'h-9 px-2.5 text-[0.8125rem]',
  lg: 'h-10 px-3 text-sm',
};

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[0.6875rem] font-medium tracking-[0.04em] text-fg-muted uppercase"
        >
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[0.6875rem] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.6875rem] text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: keyof typeof SIZES;
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ size = 'md', invalid, prefix, suffix, className, ...rest }: InputProps) {
  if (prefix || suffix) {
    return (
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 text-fg-subtle">{prefix}</span>
        )}
        <input
          className={clsx(
            CONTROL,
            SIZES[size],
            invalid && 'border-danger focus:border-danger focus:ring-danger/25',
            prefix && 'pl-9',
            suffix && 'pr-9',
            className,
          )}
          {...rest}
        />
        {suffix && <span className="absolute right-3 text-fg-subtle">{suffix}</span>}
      </div>
    );
  }
  return (
    <input
      className={clsx(
        CONTROL,
        SIZES[size],
        invalid && 'border-danger focus:border-danger focus:ring-danger/25',
        className,
      )}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={clsx(
        CONTROL,
        'min-h-20 resize-y px-2.5 py-1.5 text-[0.8125rem] leading-relaxed',
        invalid && 'border-danger focus:border-danger focus:ring-danger/25',
        className,
      )}
      {...rest}
    />
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: keyof typeof SIZES;
  options?: { value: string; label: string }[];
}

export function Select({ size = 'md', options, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={clsx(CONTROL, SIZES[size], 'cursor-pointer appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
      }}
      {...rest}
    >
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={id} className="block text-[0.8125rem] font-medium text-fg">
              {label}
            </label>
          )}
          {description && (
            <p className="mt-0.5 text-[0.6875rem] text-fg-muted">{description}</p>
          )}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={clsx(
            'inline-block size-4 transform rounded-full bg-white transition-transform duration-150',
            checked ? 'translate-x-[1.15rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-[0.375rem] border border-line bg-surface-2 p-0.5',
        className,
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-[0.25rem] font-medium transition-colors',
              size === 'sm' ? 'px-2 py-0.5 text-[0.75rem]' : 'px-2.5 py-1 text-[0.8125rem]',
              active
                ? 'bg-brand text-white'
                : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
