import clsx from 'clsx';
import { createContext, useContext, useEffect, useRef } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/** Lets Input, Select, Textarea and Switch pick up the Field label. */
const FieldLabelContext = createContext<string | undefined>(undefined);

export function useFieldLabel(): string | undefined {
  return useContext(FieldLabelContext);
}

const CONTROL =
  'w-full r-control border bg-surface text-fg placeholder:text-fg-subtle ' +
  'border-line hover:border-line-strong focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-surface-2';

const SIZES = {
  sm: 'h-9 px-3 text-[0.8125rem]',
  md: 'h-10 px-3 text-[0.875rem]',
  lg: 'h-12 px-3.5 text-[0.9375rem]',
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
  const labelText = typeof label === 'string' ? label : undefined;
  const wrapRef = useRef<HTMLDivElement>(null);

  // Raw controls (a range slider, a native select) get the label text too, so
  // every input inside a Field has an accessible name.
  useEffect(() => {
    if (!labelText || !wrapRef.current) return;
    const field = wrapRef.current.querySelector<HTMLElement>('input, select, textarea');
    if (!field) return;
    if (field.getAttribute('aria-label') || field.getAttribute('aria-labelledby') || field.id) return;
    field.setAttribute('aria-label', labelText);
  }, [labelText]);

  return (
    <div ref={wrapRef} className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[0.8125rem] leading-none font-semibold text-fg-muted"
        >
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <FieldLabelContext.Provider value={labelText}>{children}</FieldLabelContext.Provider>
      {error ? (
        <p className="text-[0.75rem] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.75rem] leading-relaxed text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: keyof typeof SIZES;
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  size = 'md',
  invalid,
  prefix,
  suffix,
  leading,
  trailing,
  className,
  ref,
  ...rest
}: InputProps) {
  const fieldLabel = useFieldLabel();
  const pre = prefix ?? leading;
  const suf = suffix ?? trailing;
  const accessibleName = rest['aria-label'] ?? (rest.id ? undefined : fieldLabel);
  const nameProp = accessibleName ? { 'aria-label': accessibleName } : {};
  if (pre || suf) {
    return (
      <div className="relative flex items-center">
        {pre && (
          <span className="pointer-events-none absolute left-3 flex items-center text-fg-subtle">
            {pre}
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            CONTROL,
            SIZES[size],
            invalid && 'border-danger focus:border-danger focus:ring-danger/20',
            pre && 'pl-10',
            suf && 'pr-10',
            className,
          )}
          {...rest}
          {...nameProp}
        />
        {suf && <span className="absolute right-3 flex items-center text-fg-subtle">{suf}</span>}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      className={clsx(
        CONTROL,
        SIZES[size],
        invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        className,
      )}
      {...rest}
      {...nameProp}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  const fieldLabel = useFieldLabel();
  const accessibleName = rest['aria-label'] ?? (rest.id ? undefined : fieldLabel);
  return (
    <textarea
      className={clsx(
        CONTROL,
        'min-h-24 resize-y px-3 py-2.5 text-[0.875rem] leading-relaxed',
        invalid && 'border-danger focus:border-danger focus:ring-danger/20',
        className,
      )}
      {...rest}
      {...(accessibleName ? { 'aria-label': accessibleName } : {})}
    />
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: keyof typeof SIZES;
  options?: { value: string; label: string }[];
}

export function Select({ size = 'md', options, className, children, ...rest }: SelectProps) {
  const fieldLabel = useFieldLabel();
  const accessibleName = rest['aria-label'] ?? (rest.id ? undefined : fieldLabel);
  return (
    <select
      className={clsx(CONTROL, SIZES[size], 'cursor-pointer appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 -960 960 960' fill='%237b8794'%3E%3Cpath d='M480-361q-8 0-15-2.5t-13-8.5L268-556q-11-11-11-28t11-28q11-11 28-11t28 11l156 156 156-156q11-11 28-11t28 11q11 11 11 28t-11 28L508-372q-6 6-13 8.5t-15 2.5Z'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.55rem center',
      }}
      {...rest}
      {...(accessibleName ? { 'aria-label': accessibleName } : {})}
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
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={id} className="block cursor-pointer text-[0.875rem] font-medium text-fg">
              {label}
            </label>
          )}
          {description && <p className="mt-0.5 text-[0.75rem] text-fg-muted">{description}</p>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : id ? undefined : 'Toggle setting'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={clsx(
            'inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-[1.5rem]' : 'translate-x-1',
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
        'inline-flex max-w-full flex-wrap items-center gap-0.5 r-control border border-line bg-surface-2 p-0.5',
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
              'r-chip inline-flex cursor-pointer items-center gap-1.5 font-semibold whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1.5 text-[0.75rem]' : 'px-3.5 py-2 text-[0.8125rem]',
              active
                ? 'bg-brand text-white shadow-[0_1px_2px_rgb(15_23_42/0.16)]'
                : 'text-fg-muted hover:text-fg',
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
