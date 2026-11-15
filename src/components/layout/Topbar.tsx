import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusDot } from '@/components/ui/Badge';
import { NAV_ITEMS } from '@/lib/nav';
import { useApp } from '@/state/AppState';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { connection, settings, updateSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
  );

  useEffect(() => {
    const focus = () => {
      setOpen(true);
      inputRef.current?.focus();
    };
    document.addEventListener('msap:focus-search', focus);
    return () => document.removeEventListener('msap:focus-search', focus);
  }, []);

  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const needle = query.trim().toLowerCase();
  const results = NAV_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      (item.keywords ?? '').includes(needle),
  );

  const go = (to: string) => {
    navigate(to);
    setQuery('');
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg-elevated/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
        >
          <Menu className="size-[1.15rem]" />
        </Button>

        <h1 className="display hidden shrink-0 truncate text-[0.875rem] font-bold tracking-[-0.01em] text-fg md:block">
          {current?.label ?? 'Overview'}
        </h1>

        <div ref={wrapRef} className="relative ml-auto min-w-0 w-full max-w-[19rem]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) go(results[0].to);
              if (event.key === 'Escape') setOpen(false);
            }}
            placeholder="Search"
            aria-label="Search"
            className="r-control h-9 w-full border border-line bg-surface-2 pr-14 pl-8 text-[0.8125rem] text-fg transition-colors placeholder:text-fg-subtle hover:border-line-strong focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand/15 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 r-chip border border-line bg-surface px-1.5 py-0.5 text-[0.625rem] font-medium text-fg-subtle sm:block">
            Ctrl K
          </kbd>

          {open && needle && (
            <ul className="card absolute inset-x-0 top-11 z-50 overflow-hidden p-1 shadow-[var(--shadow-pop)]">
              {results.length === 0 ? (
                <li className="px-2 py-3 text-[0.8125rem] text-fg-muted">No match</li>
              ) : (
                results.map((item) => (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => go(item.to)}
                      className="r-control flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[0.8125rem] text-fg transition-colors hover:bg-surface-2"
                    >
                      <span className="text-fg-subtle">{item.icon}</span>
                      {item.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/cloud')}
          title={connection.message}
          aria-label="Cloud status"
          className={clsx(
            'r-control ml-1 flex h-9 items-center gap-1.5 border px-2.5 text-[0.6875rem] font-medium transition-colors',
            connection.state === 'online'
              ? 'border-ok/30 bg-ok-soft text-ok'
              : connection.state === 'error'
                ? 'border-danger/30 bg-danger-soft text-danger'
                : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
          )}
        >
          <StatusDot state={connection.state} />
          <span className="hidden sm:inline">
            {connection.state === 'online' ? 'Synced' : 'Local'}
          </span>
        </button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          aria-label="Toggle theme"
          title="Theme"
          className="size-9"
        >
          {settings.theme === 'dark' ? (
            <Sun className="size-[1.15rem]" />
          ) : (
            <Moon className="size-[1.15rem]" />
          )}
        </Button>
      </div>
    </header>
  );
}
