import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { MOBILE_TABS } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';

export function MobileTabBar() {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4.25rem+env(safe-area-inset-bottom,0px))] items-stretch justify-around border-t border-line bg-surface/95 px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.2)] backdrop-blur-md lg:hidden"
    >
      {MOBILE_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            clsx(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-control)] px-1 py-1 text-[0.6875rem] font-semibold transition-colors',
              isActive ? 'text-brand' : 'text-ink-muted hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={clsx(
                  'inline-flex h-7 items-center justify-center rounded-full px-3 transition-colors',
                  isActive ? 'bg-brand-soft' : 'bg-transparent',
                )}
              >
                <GIcon name={tab.icon} size={22} />
              </span>
              <span className="max-w-full truncate">{tab.shortLabel ?? tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
