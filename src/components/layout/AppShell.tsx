import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { AuthModal } from '@/components/auth/AuthModal';
import { desktop } from '@/lib/desktop';

export function AppShell({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    return desktop.app.onNavigate((path) => {
      if (path) navigate(path);
    });
  }, [navigate]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-ink">
      <Sidebar />
      {mobileOpen && <Sidebar mobileOpen onCloseMobile={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-3.5 pt-4 pb-20 sm:px-6 sm:pt-5 lg:pb-8">
          <div className="mx-auto max-w-[1360px]">{children ?? <Outlet />}</div>
        </main>
        <MobileTabBar />
      </div>

      <AuthModal />
    </div>
  );
}
