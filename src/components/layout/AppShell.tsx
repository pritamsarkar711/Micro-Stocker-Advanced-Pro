import { useCallback, useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';
import { MobileHeader } from './MobileHeader';
import { AuthModal } from '@/components/auth/AuthModal';
import { SecurityBanner } from '@/components/auth/SecurityBanner';
import { UpdateNotice } from '@/components/app/UpdateNotice';
import { useLicense } from '@/state/LicenseState';
import { desktop } from '@/lib/desktop';
import { useToast } from '@/state/ToastState';

/**
 * A suspended account is enforced on the server, but the app must say so in one
 * place instead of letting every button fail with "account blocked".
 */
function AccountSuspendedNotice() {
  const { isBlocked } = useLicense();
  if (!isBlocked) return null;
  return (
    <div className="mb-3 rounded-[var(--r-card)] border border-danger/30 bg-danger-soft p-3">
      <p className="text-sm font-semibold text-danger">This account is suspended</p>
      <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
        Generating, plan downloads and credit spending are paused until support restores the account. Your
        library and files on this device are untouched.
      </p>
      <Link
        to="/contact"
        className="mt-2 inline-flex h-9 items-center rounded-[var(--r-control)] border border-danger/40 bg-surface px-3 text-2xs font-semibold text-danger"
      >
        Contact support
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return desktop.app.onNavigate((path) => {
      if (path) navigate(path);
    });
  }, [navigate]);

  // The Android shell reports a saved file instead of a download.
  useEffect(() => {
    const onSaved = (event: Event) => {
      const name = (event as CustomEvent<{ filename?: string }>).detail?.filename;
      toast.success('Saved to Documents', name);
    };
    window.addEventListener('msap:file-saved', onSaved);
    return () => window.removeEventListener('msap:file-saved', onSaved);
  }, [toast]);

  // Escape closes the open drawer. The hardware back button also works because
  // the drawer lives in the router: a pop changes the location, and the route
  // effect below closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const closeNav = useCallback(() => setMobileOpen(false), []);

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
      {mobileOpen && <Sidebar mobileOpen onCloseMobile={closeNav} />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="hidden shrink-0 lg:block">
          <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        </div>
        <MobileHeader onOpenNav={() => setMobileOpen(true)} />
        <main
          id="workspace-main"
          className={clsx(
            'workspace flex-1 overflow-x-hidden overflow-y-auto px-3.5 pt-3 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pt-4 lg:px-6 lg:pt-6 lg:pb-8 xl:px-8',
            mobileOpen && 'overflow-hidden',
          )}
        >
          <div className="workspace workspace-enter">
            <SecurityBanner />
            <AccountSuspendedNotice />
            <UpdateNotice />
            {children ?? <Outlet />}
          </div>
        </main>
        <MobileTabBar onOpenMore={() => setMobileOpen(true)} />
      </div>

      <AuthModal />
    </div>
  );
}
