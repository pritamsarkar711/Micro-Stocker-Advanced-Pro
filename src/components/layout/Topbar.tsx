import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { navItemsFor } from '@/lib/nav';
import { GIcon } from '@/components/ui/GoogleIcon';
import { ThemeToggle } from '@/components/ui/ThemeSwitch';
import { WindowControls } from './WindowControls';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useLicense } from '@/state/LicenseState';

export interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const navigate = useNavigate();
  const { user, openAuth } = useAuth();
  const { items } = useLibrary();
  const { isAdmin, premium, remainingMs, loading: licenseLoading } = useLicense();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Narrow windows show a shorter placeholder so the field label never truncates.
  const [compact, setCompact] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 640,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

    // An empty field still helps: jump to a page or reopen a recent asset.
    if (!q) {
      const quick = navItemsFor(isAdmin)
        .filter((item) => !item.secondary && !item.adminOnly)
        .slice(0, 6)
        .map((item) => ({
          id: `nav:${item.to}`,
          label: item.label,
          sub: 'Open page',
          icon: item.icon,
          to: item.to,
        }));
      const recent = items.slice(0, 3).map((it) => ({
        id: `it:${it.id}`,
        label: it.name,
        sub: it.metadata.title || 'Library asset',
        icon: 'image' as const,
        to: `/library?item=${encodeURIComponent(it.id)}`,
      }));
      return [...quick, ...recent];
    }

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

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  const showPanel = focused;

  return (
    <header className="drag-region sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="no-drag inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Open navigation menu"
        >
          <GIcon name="menu" size={22} />
        </button>

        <div ref={wrapRef} className="no-drag relative w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
            <GIcon name="search" size={19} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((index) => Math.min(results.length - 1, index + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              } else if (e.key === 'Enter') {
                const hit = results[activeIndex] ?? results[0];
                if (hit) {
                  navigate(hit.to);
                  setQuery('');
                  setFocused(false);
                }
              } else if (e.key === 'Escape') {
                setQuery('');
                setFocused(false);
                inputRef.current?.blur();
              }
            }}
            placeholder={compact ? 'Search' : 'Search pages, tools or assets'}
            aria-label="Search pages, tools or assets"
            role="combobox"
            aria-expanded={showPanel && results.length > 0}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            className="h-10 w-full rounded-[var(--r-control)] border border-line bg-surface-2 pr-16 pl-10 text-[0.8125rem] text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-brand/12"
          />
          {!compact && (
            <kbd className="pointer-events-none absolute inset-y-0 right-2.5 my-auto inline-flex h-6 items-center gap-0.5 rounded-[var(--r-xs)] border border-line bg-surface px-1.5 font-sans text-2xs font-semibold text-ink-faint">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          )}

          {showPanel && (
            <div
              id="global-search-results"
              role="listbox"
              className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-[var(--r-card)] border border-line bg-surface p-1.5 shadow-[var(--elev-3)]"
            >
              <div className="px-2.5 py-1.5 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
                {query.trim() ? 'Results' : 'Quick jump'}
              </div>
              {results.length === 0 ? (
                <div className="px-3 py-4 text-center text-[0.8125rem] text-ink-muted">
                  No page or asset matches “{query.trim()}”
                </div>
              ) : (
                results.map((hit, index) => (
                  <button
                    key={hit.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      navigate(hit.to);
                      setQuery('');
                      setFocused(false);
                    }}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-[var(--r-chip)] px-2.5 py-2 text-left transition-colors',
                      index === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--r-chip)] bg-brand-soft text-brand">
                      <GIcon name={hit.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">{hit.label}</span>
                      <span className="block truncate text-2xs text-ink-muted">{hit.sub}</span>
                    </span>
                    <GIcon name="chevron_right" size={16} className="shrink-0 text-ink-faint" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="no-drag flex shrink-0 items-center gap-1.5">
        {!licenseLoading && !isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/subscription')}
            className={clsx(
              'hidden h-9 items-center gap-1.5 rounded-[var(--r-control)] border px-2.5 text-[0.75rem] font-semibold transition-colors sm:inline-flex',
              premium
                ? 'border-line bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink'
                : 'border-brand bg-brand-soft text-brand-fg hover:bg-brand hover:text-on-brand',
            )}
            title={premium ? 'Subscription active' : 'Choose a plan'}
          >
            <GIcon name={premium ? 'verified' : 'workspace_premium'} size={16} />
            <span>{premium ? `${daysLeft}d left` : 'Go Pro'}</span>
          </button>
        )}

        <ThemeToggle />

        {user ? (
          <button
            type="button"
            onClick={() => openAuth('account')}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface pr-2 pl-1 text-[0.8125rem] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-2"
            aria-haspopup="dialog"
            title={`${user.displayName} · ${user.email}`}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-7 items-center justify-center rounded-full bg-brand text-[0.75rem] font-bold text-on-brand"
            >
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[8rem] truncate md:inline">{user.displayName}</span>
            <GIcon name="expand_more" aria-hidden="true" size={16} className="hidden text-ink-faint md:inline" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-control)] bg-brand px-3 text-[0.8125rem] font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            <GIcon name="account_circle" size={17} />
            <span>Sign in</span>
          </button>
        )}

        <WindowControls />
      </div>
    </header>
  );
}
