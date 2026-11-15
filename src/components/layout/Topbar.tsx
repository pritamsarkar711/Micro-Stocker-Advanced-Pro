import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Cloud,
  CloudOff,
  Menu,
  Minus,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusDot } from '@/components/ui/Badge';
import { KeyHint } from '@/components/ui/Misc';
import { NAV_ITEMS } from '@/lib/nav';
import { useApp } from '@/state/AppState';
import { isDesktop } from '@/lib/desktop';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { connection, settings, updateSettings, zoom, nudgeZoom, setZoom, runtime } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
  );

  /* Ctrl/Cmd+K focuses search (dispatched from the global shortcut handler). */
  useEffect(() => {
    const focus = () => {
      setSearchOpen(true);
      inputRef.current?.focus();
    };
    document.addEventListener('msap:focus-search', focus);
    return () => document.removeEventListener('msap:focus-search', focus);
  }, []);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const results = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const cloudState = connection.state;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg-elevated/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>

        {/* Title / breadcrumb */}
        <div className="hidden min-w-0 shrink-0 md:block">
          <p className="text-[0.6875rem] font-medium tracking-wide text-fg-subtle uppercase">
            Micro Stocker Advanced Pro
          </p>
          <h1 className="truncate text-sm font-semibold text-fg sm:text-base">
            {current?.label ?? 'Overview'}
          </h1>
        </div>

        {/* Search */}
        <div ref={searchRef} className="relative ml-auto w-full max-w-xs sm:max-w-sm md:ml-6">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search pages…"
              aria-label="Search pages"
              className="h-10 w-full rounded-lg border border-line bg-surface-2 pr-16 pl-9 text-sm text-fg placeholder:text-fg-subtle focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20 focus:outline-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:block">
              <KeyHint>Ctrl K</KeyHint>
            </span>
          </div>

          {searchOpen && query.trim() && (
            <div className="card absolute inset-x-0 top-12 z-50 overflow-hidden p-1 shadow-[var(--shadow-pop)]">
              {results.length === 0 ? (
                <p className="px-3 py-4 text-sm text-fg-muted">
                  No page matches “{query}”. Feature modules arrive with the spec.
                </p>
              ) : (
                <ul>
                  {results.map((item) => (
                    <li key={item.to}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(item.to);
                          setQuery('');
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-fg transition hover:bg-surface-3"
                      >
                        <span className="text-fg-subtle">{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.label}</span>
                          {item.description && (
                            <span className="block truncate text-xs text-fg-subtle">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/cloud')}
            title={connection.message}
            className={clsx(
              'hidden items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition sm:inline-flex',
              cloudState === 'online'
                ? 'border-ok/40 bg-ok-soft text-ok'
                : cloudState === 'error'
                  ? 'border-danger/40 bg-danger-soft text-danger'
                  : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <StatusDot state={cloudState} />
            {cloudState === 'online' ? (
              <>
                <Cloud className="size-3.5" /> Cloud
                {connection.latencyMs !== null && (
                  <span className="tabular-nums opacity-70">{connection.latencyMs}ms</span>
                )}
              </>
            ) : cloudState === 'connecting' ? (
              <>
                <Wifi className="size-3.5" /> Connecting
              </>
            ) : cloudState === 'error' ? (
              <>
                <CloudOff className="size-3.5" /> Cloud error
              </>
            ) : (
              <>
                <CloudOff className="size-3.5" /> Offline
              </>
            )}
          </button>

          {/* Desktop-only zoom controls: real DPI/legibility support */}
          {isDesktop && (
            <div className="hidden items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5 md:flex">
              <button
                type="button"
                onClick={() => nudgeZoom(-0.1)}
                className="rounded-md p-1.5 text-fg-muted transition hover:bg-surface-3 hover:text-fg"
                aria-label="Zoom out"
                title="Zoom out (Ctrl -)"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="rounded-md px-1.5 py-1 font-mono text-[0.6875rem] text-fg-muted tabular-nums transition hover:bg-surface-3 hover:text-fg"
                title="Reset zoom (Ctrl 0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => nudgeZoom(0.1)}
                className="rounded-md p-1.5 text-fg-muted transition hover:bg-surface-3 hover:text-fg"
                aria-label="Zoom in"
                title="Zoom in (Ctrl +)"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Theme: ${settings.theme}`}
          >
            {settings.theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            aria-label="Open settings"
            title="Settings"
            className={clsx(location.pathname === '/settings' && 'bg-surface-3 text-fg')}
          >
            <Settings className="size-5" />
          </Button>
        </div>
      </div>

      {/* Mobile page title */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 md:hidden">
        <p className="truncate text-xs font-semibold text-fg">{current?.label ?? 'Overview'}</p>
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-fg-subtle">
          <StatusDot state={cloudState} />
          {cloudState === 'online'
            ? 'Cloud'
            : cloudState === 'connecting'
              ? 'Connecting'
              : cloudState === 'error'
                ? 'Cloud error'
                : 'Offline'}
          <span className="opacity-60">·</span>
          {runtime.isDesktop ? 'Desktop' : 'Preview'}
        </span>
      </div>
    </header>
  );
}
