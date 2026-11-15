import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '@/lib/nav';

/** Phone-width navigation: thumb-reachable tabs, hidden from lg upwards. */
export function MobileTabBar() {
  const items = NAV_ITEMS.filter((item) => item.tab).slice(0, 4);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated/95 backdrop-blur-md safe-bottom lg:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-[0.625rem] font-medium transition',
                  isActive ? 'text-brand-fg' : 'text-fg-subtle hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'flex size-8 items-center justify-center rounded-lg transition',
                      isActive && 'bg-brand-soft',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
