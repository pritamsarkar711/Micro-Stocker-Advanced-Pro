import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { MOBILE_TABS } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';

/**
 * The bottom bar is the phone's primary navigation: four destinations plus a
 * More button that opens the full rail. Everything is at least 44 px tall and
 * the bar itself pads for the home indicator, so nothing sits under a gesture
 * area.
 */
export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const tabs = MOBILE_TABS.slice(0, 4);
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] items-stretch justify-around border-t border-line bg-surface/95 px-0.5 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_20px_-14px_rgb(0_0_0/0.35)] backdrop-blur-md lg:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            clsx(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--r-control)] text-[0.625rem] font-semibold transition-colors',
              isActive ? 'text-brand-fg' : 'text-ink-muted active:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={clsx(
                  'inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-brand-soft' : 'bg-transparent',
                )}
              >
                <GIcon name={tab.icon} size={22} />
              </span>
              <span className="max-w-full truncate px-0.5">{tab.shortLabel ?? tab.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onOpenMore}
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--r-control)] text-[0.625rem] font-semibold text-ink-muted active:text-ink"
      >
        <span className="inline-flex h-7 w-12 items-center justify-center rounded-full">
          <GIcon name="menu" size={22} />
        </span>
        <span className="max-w-full truncate px-0.5">More</span>
      </button>
    </nav>
  );
}
