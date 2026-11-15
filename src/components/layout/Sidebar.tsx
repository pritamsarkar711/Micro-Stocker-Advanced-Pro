import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav';
import { Logo } from './Logo';
import { StatusDot } from '@/components/ui/Badge';
import { useApp } from '@/state/AppState';

/**
 * Navigation rail. Material-style: the active row is a soft brand pill with a
 * leading 3px bar, and every group carries a small uppercase caption.
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { connection } = useApp();

  const content = (
    <div
      className={clsx(
        'flex h-full flex-col border-r border-line bg-bg-elevated',
        collapsed ? 'w-[4.25rem]' : 'w-[15.5rem]',
      )}
    >
      <div
        className={clsx(
          'flex h-14 shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3.5',
        )}
      >
        {collapsed ? (
          <Logo size={28} />
        ) : (
          <Logo size={28} withWordmark />
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          className="r-control ml-auto p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 overflow-x-hidden overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="px-2.5 pb-1.5 text-[0.625rem] font-semibold tracking-[0.09em] text-fg-subtle uppercase">
                  {group.title}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'r-control group relative flex h-9 items-center text-[0.8125rem] font-medium transition-colors duration-150',
                          collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
                          isActive
                            ? 'bg-brand-soft text-brand-fg'
                            : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={clsx(
                              'absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span
                            className={clsx(
                              'shrink-0 transition-colors',
                              isActive ? 'text-brand' : 'text-fg-subtle group-hover:text-fg-muted',
                            )}
                          >
                            {item.icon}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-2.5">
        <div
          className={clsx(
            'flex items-center gap-2 py-1',
            collapsed ? 'justify-center' : 'px-1.5',
          )}
          title={connection.message}
        >
          <StatusDot state={connection.state} />
          {!collapsed && (
            <span className="truncate text-[0.6875rem] font-medium text-fg-subtle">
              {connection.state === 'online' ? 'Cloud linked' : 'Local only'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={clsx(
            'r-control hidden h-8 w-full items-center gap-2 text-[0.6875rem] font-medium text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg lg:flex',
            collapsed ? 'justify-center' : 'px-1.5',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">{content}</aside>

      <div
        className={clsx('fixed inset-0 z-50 lg:hidden', mobileOpen ? '' : 'pointer-events-none')}
        aria-hidden={!mobileOpen}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-black/50 transition-opacity duration-150',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onCloseMobile}
        />
        <div
          className={clsx(
            'absolute inset-y-0 left-0 h-full max-w-[85vw] transition-transform duration-200 ease-[var(--ease-emphasized)]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
