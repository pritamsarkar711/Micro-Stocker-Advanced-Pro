import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav';
import { Logo } from './Logo';
import { StatusDot } from '@/components/ui/Badge';
import { useApp } from '@/state/AppState';

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
        collapsed ? 'w-[3.75rem]' : 'w-56',
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-3">
        <Logo size={26} />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold tracking-tight text-fg">
            Micro Stocker
          </span>
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          className="r-control -mr-1 ml-auto p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="mb-3">
              {!collapsed && (
                <p className="px-2 pb-1 pt-1 text-[0.625rem] font-semibold tracking-[0.1em] text-fg-subtle uppercase">
                  {group.title}
                </p>
              )}
              <ul>
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'r-control relative flex h-8 items-center gap-2.5 text-[0.8125rem] font-medium transition-colors',
                          collapsed ? 'justify-center px-0' : 'px-2',
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
                              'absolute left-0 h-4 w-[2px] rounded-full bg-brand',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span
                            className={clsx('shrink-0', isActive ? 'text-brand' : 'text-fg-subtle')}
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

      <div className="border-t border-line p-2">
        <div
          className={clsx(
            'flex items-center gap-2 px-2 py-1.5',
            collapsed && 'justify-center px-0',
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
            'r-control hidden h-8 w-full items-center gap-2 px-2 text-[0.6875rem] font-medium text-fg-subtle hover:bg-surface-2 hover:text-fg lg:flex',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
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
            'absolute inset-y-0 left-0 h-full max-w-[80vw] transition-transform duration-150 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
