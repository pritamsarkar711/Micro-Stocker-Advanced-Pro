import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useLicense } from '@/state/LicenseState';

/**
 * Every workspace route waits for a fresh server answer about the account
 * (blocked / active). Cached storage is never trusted.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { loading, verified, isBlocked, refresh, error } = useLicense();

  if (verified) return <>{children}</>;

  const title = loading
    ? 'Checking your account…'
    : isBlocked
      ? 'Account disabled'
      : 'Unable to verify account';

  const copy = loading
    ? 'One moment.'
    : isBlocked
      ? 'This account has been disabled. Contact the administrator.'
      : error || 'The licensing server could not be reached. Check your connection and try again.';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink">
      <div className="w-full max-w-md rounded-[var(--r-card)] border border-line bg-surface p-6 text-center shadow-[var(--elev-2)]">
        <Logo size={44} className="mx-auto" />
        <h1 className="mt-4 text-[1.125rem] font-bold">{title}</h1>
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-muted">{copy}</p>
        {!loading && (
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => void refresh()} icon={<GIcon name="refresh" size={18} />}>
              Try again
            </Button>
            <Button variant="outline" onClick={() => void logout()} icon={<GIcon name="logout" size={18} />}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
