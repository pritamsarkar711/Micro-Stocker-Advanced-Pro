import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { MOBILE_TABS } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';

export function MobileTabBar() {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-line bg-surface px-1 pb-[var(--safe-b)] lg:hidden"
    >
      {MOBILE_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium',
              isActive ? 'text-accent' : 'text-ink-muted',
            )
          }
        >
          <GIcon name={tab.icon} size={20} />
          <span className="truncate">{tab.shortLabel ?? tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
