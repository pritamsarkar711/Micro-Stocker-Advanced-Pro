import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav';
import { Logo } from './Logo';
import { Badge, StatusDot } from '@/components/ui/Badge';
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
  const { connection, runtime } = useApp();

  const content = (
    <div
      className={clsx(
        'flex h-full flex-col border-r border-line bg-bg-elevated transition-[width] duration-200',
        collapsed ? 'w-[4.75rem]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 py-4 sm:px-4">
        <Logo size={collapsed ? 34 : 38} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-fg">Micro Stocker</p>
            <p className="truncate text-[0.6875rem] text-fg-subtle">
              Advanced Pro · v{runtime.version}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-3 hover:text-fg lg:hidden"
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 sm:px-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="mb-4">
              {!collapsed && (
                <p className="px-2 pb-1.5 text-[0.625rem] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
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
                          'group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition',
                          collapsed ? 'justify-center px-0' : 'px-2.5',
                          isActive
                            ? 'bg-brand-soft text-brand-fg'
                            : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={clsx(
                              'absolute left-0 h-5 w-0.5 rounded-r-full bg-brand transition-opacity',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="shrink-0">{item.icon}</span>
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

      {/* Footer: connection + collapse */}
      <div className="border-t border-line p-2 sm:p-3">
        {!collapsed ? (
          <div className="mb-2 rounded-xl border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <StatusDot state={connection.state} />
              <p className="text-xs font-semibold text-fg">
                {connection.state === 'online'
                  ? 'Cloud connected'
                  : connection.state === 'connecting'
                    ? 'Connecting…'
                    : connection.state === 'error'
                      ? 'Cloud error'
                      : 'Offline mode'}
              </p>
            </div>
            <p className="mt-1 line-clamp-2 text-[0.6875rem] leading-relaxed text-fg-muted">
              {connection.message}
            </p>
            <Badge
              tone={runtime.isDesktop ? 'brand' : 'neutral'}
              className="mt-2"
              dot
            >
              {runtime.isDesktop ? 'Desktop build' : 'Browser preview'}
            </Badge>
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <StatusDot state={connection.state} />
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={clsx(
            'hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-fg-subtle transition hover:bg-surface-3 hover:text-fg lg:flex',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: static rail */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">{content}</aside>

      {/* Mobile / narrow window: off-canvas drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onCloseMobile}
        />
        <div
          className={clsx(
            'absolute inset-y-0 left-0 h-full transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
      </div>
    </>
  );
}
