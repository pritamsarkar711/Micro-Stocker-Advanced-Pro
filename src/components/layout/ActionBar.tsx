import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * The primary action for a form page.
 *
 * On a phone it pins to the bottom of the viewport, just above the tab bar, so
 * the main button is always one thumb away instead of two screens down. From
 * `sm` up it flows inline exactly where it was written.
 *
 * Pages using it add `max-sm:pb-24` to their form container so the bar never
 * covers the last field.
 */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'z-20 flex items-center gap-2.5 border-t border-line bg-surface px-3.5 py-2.5',
        'max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))]',
        'md:static md:border-0 md:bg-transparent md:p-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
