import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav';
import { Logo } from './Logo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { settings, updateSettings } = useApp();
  const { items } = useLibrary();
  const collapsed = settings.sidebarCollapsed && !mobileOpen;

  const content = (
    <aside
      className={clsx(
        'flex h-full flex-col border-r border-line bg-surface select-none',
        collapsed ? 'w-[62px]' : 'w-[228px]',
      )}
    >
      <div
        className={clsx(
          'flex h-[52px] shrink-0 items-center border-b border-line px-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <NavLink
          to="/"
          onClick={onCloseMobile}
          className="min-w-0"
          aria-label="Micro Stocker Advanced Pro home"
        >
          <Logo size={28} showWordmark={!collapsed} />
        </NavLink>
        {mobileOpen ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close navigation"
          >
            <GIcon name="close" size={18} />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={() => updateSettings({ sidebarCollapsed: true })}
              className="hidden size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-ink lg:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <GIcon name="left_panel_close" size={17} />
            </button>
          )
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const entries = NAV_ITEMS.filter((it) => it.group === group.id);
          return (
            <div key={group.id}>
              {!collapsed && (
                <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {entries.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 rounded-[var(--r-control)] px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-accent-soft font-semibold text-accent'
                            : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                        )
                      }
                    >
                      <GIcon name={item.icon} size={18} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.to === '/library' && items.length > 0 && (
                            <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-2xs font-semibold text-ink-muted tabular-nums">
                              {items.length}
                            </span>
                          )}
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

      {collapsed && !mobileOpen && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={() => updateSettings({ sidebarCollapsed: false })}
            className="flex h-8 w-full items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <GIcon name="left_panel_open" size={18} />
          </button>
        </div>
      )}
    </aside>
  );

  if (mobileOpen) {
    return (
      <div className="fixed inset-0 z-40 flex lg:hidden">
        <div
          className="fixed inset-0 bg-black/45"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
        <div className="relative z-10 h-full">{content}</div>
      </div>
    );
  }

  return <div className="hidden h-full shrink-0 lg:block">{content}</div>;
}
