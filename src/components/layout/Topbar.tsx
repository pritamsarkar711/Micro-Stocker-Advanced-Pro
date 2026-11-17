import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { navItemsFor } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useLicense } from '@/state/LicenseState';

export interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const navigate = useNavigate();
  const { connection } = useApp();
  const { user, openAuth } = useAuth();
  const { items } = useLibrary();
  const { isAdmin, premium, remainingMs, loading: licenseLoading } = useLicense();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [focused]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const navHits = navItemsFor(isAdmin)
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.keywords?.some((k) => k.toLowerCase().includes(q)),
      )
      .map((n) => ({ id: `nav:${n.to}`, label: n.label, sub: 'Open page', icon: n.icon, to: n.to }));

    const libHits = items
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.metadata.title.toLowerCase().includes(q) ||
          it.metadata.keywords.some((k) => k.includes(q)),
      )
      .slice(0, 5)
      .map((it) => ({
        id: `it:${it.id}`,
        label: it.name,
        sub: it.metadata.title || 'Library asset',
        icon: 'image' as const,
        to: `/library?item=${encodeURIComponent(it.id)}`,
      }));

    return [...navHits, ...libHits].slice(0, 8);
  }, [items, isAdmin, query]);

  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86_400_000));

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur-md sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Open navigation menu"
        >
          <GIcon name="menu" size={22} />
        </button>

        <div ref={wrapRef} className="relative w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
            <GIcon name="search" size={19} />
          </span>
          <input
            type="search"
            value={query}
            onFocus={() => setFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                navigate(results[0].to);
                setQuery('');
                setFocused(false);
              } else if (e.key === 'Escape') {
                setQuery('');
                setFocused(false);
              }
            }}
            placeholder="Search pages, tools or assets"
            aria-label="Search pages, tools or assets"
            className="h-10 w-full rounded-[var(--r-control)] border border-line bg-surface-2 pr-3 pl-10 text-[0.8125rem] text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-brand/12"
          />

          {focused && query.trim() !== '' && (
            <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-[var(--r-card)] border border-line bg-surface p-1.5 shadow-[var(--elev-3)]">
              {results.length === 0 ? (
                <div className="px-3 py-4 text-center text-[0.8125rem] text-ink-muted">No results</div>
              ) : (
                results.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      navigate(hit.to);
                      setQuery('');
                      setFocused(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-[var(--r-chip)] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--r-chip)] bg-brand-soft text-brand">
                      <GIcon name={hit.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">{hit.label}</span>
                      <span className="block truncate text-[0.6875rem] text-ink-muted">{hit.sub}</span>
                    </span>
                    <GIcon name="chevron_right" size={16} className="shrink-0 text-ink-faint" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {!licenseLoading && (
          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/admin' : '/subscription')}
            className={clsx(
              'hidden h-10 items-center gap-2 rounded-[var(--r-control)] border px-3 text-[0.75rem] font-semibold transition-colors sm:inline-flex',
              isAdmin
                ? 'border-secondary/35 bg-secondary-soft text-secondary-fg hover:brightness-97 dark:hover:brightness-110'
                : premium
                  ? 'border-line bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink'
                  : 'border-danger/35 bg-danger-soft text-danger',
            )}
            title={isAdmin ? 'Administrator account' : premium ? 'Subscription active' : 'Activate a subscription'}
          >
            <GIcon
              name={isAdmin ? 'admin_panel_settings' : premium ? 'verified' : 'error'}
              size={17}
            />
            <span>{isAdmin ? 'Admin' : premium ? `${daysLeft}d left` : 'Activate plan'}</span>
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/cloud')}
            className={clsx(
              'hidden h-10 items-center gap-2 rounded-[var(--r-control)] border border-line px-3 text-[0.75rem] font-medium transition-colors md:inline-flex',
              connection.state === 'online'
                ? 'bg-ok-soft text-ok'
                : 'bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
            title={connection.message}
          >
            <GIcon name={connection.state === 'online' ? 'cloud_done' : 'cloud_off'} size={17} />
            <span>{connection.state === 'online' ? 'Synced' : 'Local'}</span>
          </button>
        )}

        <ThemeSwitch />

        {user ? (
          <button
            type="button"
            onClick={() => openAuth('account')}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface pr-2.5 pl-1.5 text-[0.8125rem] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
            title={user.email}
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-[0.75rem] font-bold text-on-brand">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[9rem] truncate md:inline">{user.displayName}</span>
            <GIcon name="expand_more" size={17} className="hidden text-ink-faint md:inline" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--r-control)] bg-brand px-3.5 text-[0.8125rem] font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            <GIcon name="account_circle" size={18} />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </header>
  );
}
