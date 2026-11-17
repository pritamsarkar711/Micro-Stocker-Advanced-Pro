import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLicense } from '@/state/LicenseState';
import { PageLoading } from '@/components/layout/PageLoading';
import { GIcon } from '@/components/ui/GoogleIcon';

/** Route-level role check. Hiding navigation is not enough on its own. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useLicense();

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
