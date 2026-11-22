import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS, navItemsFor } from '@/lib/nav';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useLicense } from '@/state/LicenseState';
import { Avatar } from '@/components/ui/Avatar';
import { appName } from '@/lib/version';

interface Hit {
  id: string;
  label: string;
  sub: string;
  icon: GoogleIconName;
  to: string;
}

/**
 * The phone header. A desktop search field squeezed next to four buttons is
 * unusable on a 360 px screen, so the field becomes a button that opens a
 * full-screen search sheet, and the title tells the user where they are.
 */
export function MobileHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { pathname } = useLocation();
  const { user, openAuth } = useAuth();
  const { isAdmin } = useLicense();
  const [searchOpen, setSearchOpen] = useState(false);

  const title = useMemo(() => {
    const match = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
      .filter((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (match) return match.label;
    if (pathname.startsWith('/generate/')) {
      const kind = pathname.split('/').pop()?.toUpperCase() ?? 'AI';
      return `${kind} generator`;
    }
    if (pathname.startsWith('/admin')) return 'Admin console';
    // Destinations that live outside the rail still need a name up top.
    if (pathname.startsWith('/report')) return 'Report issue';
    if (pathname.startsWith('/404')) return 'Page not found';
    return appName();
  }, [pathname, isAdmin]);

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-[var(--topbar-h)] shrink-0 items-center gap-1.5 border-b border-line bg-surface/95 px-2 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation menu"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted active:bg-surface-2"
        >
          <GIcon name="menu" size={23} />
        </button>

        <h1 className="min-w-0 flex-1 truncate px-0.5 text-[0.9375rem] font-bold tracking-[-0.01em] text-ink">
          {title}
        </h1>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--r-control)] text-ink-muted active:bg-surface-2"
        >
          <GIcon name="search" size={22} />
        </button>

        {user ? (
          <button
            type="button"
            onClick={() => openAuth('account')}
            aria-label={`Account: ${user.displayName}`}
            className="inline-flex size-11 shrink-0 items-center justify-center"
          >
            <Avatar stored={user.avatar} seed={user.id} size={8} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="inline-flex h-9 shrink-0 items-center rounded-[var(--r-control)] bg-brand px-3 text-[0.8125rem] font-semibold text-on-brand"
          >
            Sign in
          </button>
        )}
      </header>

      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const { items } = useLibrary();
  const { isAdmin } = useLicense();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    const nav = navItemsFor(isAdmin)
      .filter((item) => !item.secondary)
      .filter((item) => !q || item.label.toLowerCase().includes(q) || item.keywords?.some((k) => k.includes(q)))
      .map((item) => ({ id: `nav:${item.to}`, label: item.label, sub: 'Page', icon: item.icon, to: item.to }));
    const assets = items
      .filter((it) => q && (it.name.toLowerCase().includes(q) || it.metadata.title.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((it) => ({ id: `it:${it.id}`, label: it.name, sub: it.metadata.title || 'Library asset', icon: 'photo_library' as const, to: '/metadata' }));
    return [...nav, ...assets].slice(0, 14);
  }, [items, isAdmin, query]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg lg:hidden">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-2 pt-[calc(0.4rem+env(safe-area-inset-top,0px))] pb-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
            <GIcon name="search" size={19} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools or pages"
            aria-label="Search tools, pages or assets"
            className="h-11 w-full rounded-[var(--r-control)] border border-line bg-surface-2 pr-11 pl-10 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-brand focus:bg-surface focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted active:text-ink"
            >
              <GIcon name="close" size={18} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 shrink-0 items-center rounded-[var(--r-control)] px-3 text-[0.875rem] font-semibold text-brand-fg"
        >
          Cancel
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <p className="px-2 py-1.5 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
          {query.trim() ? 'Results' : 'Jump to'}
        </p>
        {hits.length === 0 ? (
          <p className="px-3 py-8 text-center text-[0.875rem] text-ink-muted">
            Nothing matches “{query.trim()}”
          </p>
        ) : (
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(hit.to);
                    onClose();
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-[var(--r-control)] px-2.5 py-2.5 text-left active:bg-surface-2',
                  )}
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-chip)] bg-brand-soft text-brand-fg">
                    <GIcon name={hit.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{hit.label}</span>
                    <span className="block truncate text-2xs text-ink-muted">{hit.sub}</span>
                  </span>
                  <GIcon name="chevron_right" size={16} className="shrink-0 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
