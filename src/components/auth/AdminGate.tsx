import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/state/AuthState';
import { useLicense } from '@/state/LicenseState';
import { PageLoading } from '@/components/layout/PageLoading';
import { GIcon } from '@/components/ui/GoogleIcon';

/** Route-level role check. Hiding navigation is not enough on its own. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useLicense();
  const { user, logout } = useAuth();

  if (loading) return <PageLoading label="Checking permissions…" />;

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-10 w-full max-w-lg rounded-[var(--r-card)] border border-line bg-surface p-6 text-center shadow-[var(--elev-1)]">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <GIcon name="lock" size={24} />
        </span>
        <h1 className="mt-4 text-[1.125rem] font-bold text-ink">Administrator only</h1>
        <p className="mt-1.5 text-[0.875rem] text-ink-muted">
          Your account does not have administrator permissions.
        </p>
        {user && (
          <p className="mt-2 text-2xs leading-relaxed text-ink-muted">
            Signed in as {user.email}. If this account should be an administrator, check two step verification: the
            console stays locked until the current code is entered. Sign out and back in to enter it.
          </p>
        )}
        {user && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--r-control)] border border-line px-3 py-2 text-[0.8125rem] font-semibold text-ink hover:border-line-strong hover:bg-surface-2"
          >
            Sign out and try again
          </button>
        )}
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-[var(--r-control)] bg-brand px-4 py-2.5 text-[0.875rem] font-semibold text-on-brand hover:bg-brand-hover"
        >
          <GIcon name="dashboard" size={18} />
          Back to overview
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
