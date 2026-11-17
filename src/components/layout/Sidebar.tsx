import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navGroupsFor } from '@/lib/nav';
import { Logo } from './Logo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useLicense } from '@/state/LicenseState';

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function remainingLabel(ms: number): string {
  if (ms <= 0) return 'Inactive';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min left`;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { settings, updateSettings } = useApp();
  const { items } = useLibrary();
  const { isAdmin, premium, remainingMs } = useLicense();
  const collapsed = settings.sidebarCollapsed && !mobileOpen;
  const groups = navGroupsFor(isAdmin);

  const content = (
    <aside
      className={clsx(
        'nav-rail flex h-full flex-col border-r border-nav-line text-nav-fg select-none',
        collapsed ? 'w-[var(--rail-w-collapsed)]' : 'w-[var(--rail-w)]',
      )}
    >
      <div
        className={clsx(
          'flex h-[var(--topbar-h)] shrink-0 items-center border-b border-nav-line px-3.5',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <NavLink
          to="/"
          onClick={onCloseMobile}
          className="min-w-0 rounded-[var(--r-control)]"
          aria-label="Micro Stocker Advanced Pro home"
        >
          <Logo size={30} showWordmark={!collapsed} tone="onDark" />
        </NavLink>
        {mobileOpen ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex size-9 items-center justify-center rounded-[var(--r-control)] text-nav-fg-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <GIcon name="close" size={20} />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={() => updateSettings({ sidebarCollapsed: true })}
              className="hidden size-9 items-center justify-center rounded-[var(--r-control)] text-nav-fg-muted transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <GIcon name="left_panel_close" size={19} />
            </button>
          )
        )}
      </div>

      <nav className="flex-1 space-y-3.5 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="mb-1 px-2.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-nav-fg-muted uppercase">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onCloseMobile}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 rounded-[var(--r-control)] px-2.5 py-[0.4rem] text-[0.8125rem] font-medium transition-colors duration-150',
                        collapsed && 'justify-center px-0 py-2',
                        isActive
                          ? 'font-semibold text-white shadow-[0_6px_16px_-8px_rgb(0_0_0/0.8)]'
                          : 'text-nav-fg hover:bg-white/8 hover:text-white',
                      )
                    }
                    style={({ isActive }: { isActive: boolean }) =>
                      isActive ? { backgroundImage: 'linear-gradient(100deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 70%, var(--secondary)) 100%)' } : undefined
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={clsx(
                            'inline-flex size-5 shrink-0 items-center justify-center',
                            isActive ? 'text-white' : 'text-nav-fg-muted group-hover:text-white',
                          )}
                        >
                          <GIcon name={item.icon} size={20} />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.to === '/library' && items.length > 0 && (
                              <span
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums',
                                  isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-nav-fg',
                                )}
                              >
                                {items.length}
                              </span>
                            )}
                            {item.to === '/admin' && (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-white uppercase">
                                Admin
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-nav-line p-2.5">
          <NavLink
            to="/subscription"
            onClick={onCloseMobile}
            className="flex items-center gap-3 rounded-[var(--r-control)] bg-white/6 px-2.5 py-2.5 transition-colors hover:bg-white/12"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/12 text-white">
              <GIcon name={isAdmin ? 'admin_panel_settings' : 'workspace_premium'} size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.75rem] font-semibold text-white">
                {isAdmin ? 'Administrator' : premium ? 'Premium plan' : 'No active plan'}
              </span>
              <span className="block truncate text-[0.6875rem] text-nav-fg-muted">
                {isAdmin ? 'Full access' : remainingLabel(remainingMs)}
              </span>
            </span>
            <GIcon name="chevron_right" size={18} className="text-nav-fg-muted" />
          </NavLink>
        </div>
      ) : (
        <div className="border-t border-nav-line p-2">
          <button
            type="button"
            onClick={() => updateSettings({ sidebarCollapsed: false })}
            className="flex h-10 w-full items-center justify-center rounded-[var(--r-control)] text-nav-fg-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <GIcon name="left_panel_open" size={19} />
          </button>
        </div>
      )}
    </aside>
  );

  if (mobileOpen) {
    return (
      <div className="fixed inset-0 z-50 flex lg:hidden">
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onCloseMobile} aria-hidden="true" />
        <div className="relative z-10 h-full animate-in-fast shadow-[var(--elev-4)]">{content}</div>
      </div>
    );
  }

  return <div className="hidden h-full shrink-0 lg:block">{content}</div>;
}
