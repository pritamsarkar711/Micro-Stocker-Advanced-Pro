import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { useApp } from '@/state/AppState';
import { desktop } from '@/lib/desktop';

/**
 * The responsive application shell.
 *
 *  ≥1280px : full sidebar (or 76px rail when collapsed) + topbar
 *  1024-1279: auto-collapsed rail + topbar
 *  <1024px : off-canvas drawer + topbar + bottom tab bar
 *
 * `?embed=1` renders just the page content - used by the Responsive Lab device
 * simulator, which loads the real app inside fixed-width frames.
 */
export function AppShell() {
  const { settings, updateSettings, ready } = useApp();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Native app menu → Help → About navigates the SPA. */
  useEffect(() => desktop.app.onNavigate((path) => navigate(path)), [navigate]);

  /* Auto-collapse the rail when the window is narrow but not mobile-sized. */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024 && window.innerWidth < 1280 && !settings.sidebarCollapsed) {
        updateSettings({ sidebarCollapsed: true });
      }
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (embed) {
    return (
      <main className="min-h-dvh w-full bg-bg p-3 sm:p-5">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh w-full bg-bg">
      <Sidebar
        collapsed={settings.sidebarCollapsed}
        onToggleCollapsed={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        {/* pb-20 keeps content clear of the mobile bottom tab bar */}
        <main id="main" className="min-w-0 flex-1 pb-20 focus:outline-none lg:pb-0" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[110rem] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>

        <MobileTabBar />
      </div>
    </div>
  );
}
