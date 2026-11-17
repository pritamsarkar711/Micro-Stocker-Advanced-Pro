import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { AuthModal } from '@/components/auth/AuthModal';
import { desktop } from '@/lib/desktop';

export function AppShell({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return desktop.app.onNavigate((path) => {
      if (path) navigate(path);
    });
  }, [navigate]);

  // Route changes should always start at the top of the workspace canvas.
  useEffect(() => {
    const main = document.getElementById('workspace-main');
    if (main) main.scrollTo({ top: 0 });
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-ink">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      {mobileOpen && <Sidebar mobileOpen onCloseMobile={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main
          id="workspace-main"
          className="workspace flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pt-5 lg:px-6 lg:pt-6 lg:pb-8 xl:px-8"
        >
          <div className="workspace animate-in-fast">{children ?? <Outlet />}</div>
        </main>
        <MobileTabBar />
      </div>

      <AuthModal />
    </div>
  );
}
