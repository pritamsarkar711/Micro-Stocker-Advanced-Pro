import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';

export interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const navigate = useNavigate();
  const { connection } = useApp();
  const { user, openAuth } = useAuth();
  const { items } = useLibrary();

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
    const navHits = NAV_ITEMS.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.keywords?.some((k) => k.toLowerCase().includes(q)),
    ).map((n) => ({ id: `nav:${n.to}`, label: n.label, sub: 'Open tool', icon: n.icon, to: n.to }));

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
  }, [items, query]);

  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between gap-2.5 border-b border-line bg-surface px-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Open menu"
        >
          <GIcon name="menu" size={20} />
        </button>

        <div ref={wrapRef} className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ink-faint">
            <GIcon name="search" size={16} />
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
            placeholder="Search tools, pages or files"
            aria-label="Search tools, pages or files"
            className="h-8 w-full rounded-[var(--r-control)] border border-line bg-surface-2/70 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint hover:border-line-strong focus:border-accent focus:bg-surface focus:outline-none"
          />

          {focused && query.trim() !== '' && (
            <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 overflow-hidden rounded-[var(--r-card)] border border-line-strong bg-surface p-1 shadow-md">
              {results.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-ink-muted">No matching results</div>
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
                    className="flex w-full items-center gap-2.5 rounded-[var(--r-xs)] px-2.5 py-2 text-left text-xs hover:bg-surface-2"
                  >
                    <GIcon name={hit.icon} size={16} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{hit.label}</span>
                      <span className="block truncate text-2xs text-ink-muted">{hit.sub}</span>
                    </span>
                    <GIcon name="chevron_right" size={14} className="shrink-0 text-ink-faint" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/cloud')}
          className={clsx(
            'hidden h-8 items-center gap-1.5 rounded-[var(--r-control)] border border-line px-2.5 text-2xs font-medium md:inline-flex',
            connection.state === 'online'
              ? 'bg-accent-soft text-accent'
              : 'bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink',
          )}
          title={connection.message}
        >
          <GIcon name={connection.state === 'online' ? 'cloud_done' : 'cloud_off'} size={14} />
          <span>{connection.state === 'online' ? 'Synced' : 'Local'}</span>
        </button>

        <ThemeSwitch />

        {user ? (
          <button
            type="button"
            onClick={() => openAuth('account')}
            className="inline-flex h-8 items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface pr-2.5 pl-1.5 text-xs font-medium text-ink hover:border-line-strong hover:bg-surface-2"
            title={user.email}
          >
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-brand">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[110px] truncate sm:inline">{user.displayName}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-control)] bg-accent px-3 text-xs font-semibold text-on-brand hover:bg-accent-hover"
          >
            <GIcon name="account_circle" size={15} />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </header>
  );
}
