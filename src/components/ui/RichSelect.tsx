import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { GIcon } from './GoogleIcon';

export interface RichOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export type RichSelectOption<T extends string = string> = RichOption<T>;

/**
 * Material Design 3 accessible select control with leading icons, brand logos
 * or circular flags on both the closed trigger and every dropdown item.
 */
export function RichSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select',
  disabled = false,
  size = 'md',
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: RichOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const heightCls =
    size === 'sm'
      ? 'h-8 px-2.5 text-[0.8125rem]'
      : size === 'lg'
        ? 'h-11 px-3.5 text-sm'
        : 'h-9.5 px-3 text-[0.8125rem]';

  return (
    <div ref={wrapRef} className={clsx('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel && selected ? `${ariaLabel}: ${selected.label}` : ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={clsx(
          'r-control flex w-full items-center gap-2 border bg-surface text-left text-fg',
          'border-line hover:border-line-strong focus:border-brand focus:ring-[3px] focus:ring-brand/15 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-55',
          open && 'border-brand ring-[3px] ring-brand/15',
          heightCls,
        )}
      >
        {selected?.icon && <span className="flex shrink-0 items-center">{selected.icon}</span>}
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-fg-subtle')}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.badge && <span className="hidden shrink-0 sm:inline-flex">{selected.badge}</span>}
        <GIcon
          name={open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          size={18}
          className="shrink-0 text-fg-subtle"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="card absolute inset-x-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-y-auto p-1 shadow-[var(--elev-3)]"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2.5 text-[0.8125rem] text-fg-subtle">No options</li>
          ) : (
            options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      'r-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[0.8125rem]',
                      active
                        ? 'bg-brand-soft font-medium text-brand-fg'
                        : 'text-fg hover:bg-surface-2',
                      option.disabled && 'pointer-events-none opacity-45',
                    )}
                  >
                    {option.icon && <span className="flex shrink-0 items-center">{option.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="block truncate text-2xs font-normal text-fg-subtle">
                          {option.sublabel}
                        </span>
                      )}
                    </span>
                    {option.badge && <span className="shrink-0">{option.badge}</span>}
                    {active && <GIcon name="check" size={16} className="shrink-0 text-brand" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
