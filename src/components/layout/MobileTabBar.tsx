import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { TAB_ITEMS } from '@/lib/nav';

/** Phone navigation: four thumb-reachable tabs, hidden from lg upwards. */
export function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated safe-bottom lg:hidden">
      <ul className="grid grid-cols-4">
        {TAB_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-0.5 py-1.5 text-[0.625rem] font-medium',
                  isActive ? 'text-brand' : 'text-fg-subtle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'flex h-6 w-10 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-brand-soft',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
