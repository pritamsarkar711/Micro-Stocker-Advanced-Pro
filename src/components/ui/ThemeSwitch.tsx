import clsx from 'clsx';
import { GIcon } from './GoogleIcon';
import { useApp } from '@/state/AppState';

/**
 * Instant dual mode Day and Night theme switch.
 * Applies the selected mode synchronously with transitions suppressed so the
 * entire interface switches in a single frame with zero delay.
 */
export function ThemeSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { isDark, setThemeInstant } = useApp();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={clsx(
        'inline-flex h-10 shrink-0 items-center gap-0.5 r-control border border-line bg-surface-2 p-0.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setThemeInstant('light')}
        aria-pressed={!isDark}
        aria-label="Light mode"
        title="Light mode"
        className={clsx(
          'inline-flex h-full items-center justify-center gap-1.5 r-chip px-2.5 text-[0.75rem] font-semibold select-none',
          !isDark
            ? 'bg-brand text-white shadow-[0_1px_2px_rgb(0_0_0/0.14)]'
            : 'text-fg-muted hover:text-fg',
        )}
      >
        <GIcon name={!isDark ? 'light_mode_fill' : 'light_mode'} size={16} />
        {!compact && <span className="hidden xl:inline">Light</span>}
      </button>
      <button
        type="button"
        onClick={() => setThemeInstant('dark')}
        aria-pressed={isDark}
        aria-label="Dark mode"
        title="Dark mode"
        className={clsx(
          'inline-flex h-full items-center justify-center gap-1.5 r-chip px-2.5 text-[0.75rem] font-semibold select-none',
          isDark
            ? 'bg-brand text-white shadow-[0_1px_2px_rgb(0_0_0/0.24)]'
            : 'text-fg-muted hover:text-fg',
        )}
      >
        <GIcon name={isDark ? 'dark_mode_fill' : 'dark_mode'} size={16} />
        {!compact && <span className="hidden xl:inline">Dark</span>}
      </button>
    </div>
  );
}

/**
 * Single-button theme toggle for the top bar. Keeps the chrome quiet: one icon
 * that reflects the live state instead of two competing segmented options.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, setThemeInstant } = useApp();
  return (
    <button
      type="button"
      onClick={() => setThemeInstant(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className={clsx(
        'no-drag inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      <GIcon name={isDark ? 'light_mode' : 'dark_mode'} size={18} />
    </button>
  );
}
