import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLicense } from '@/state/LicenseState';
import { PageLoading } from '@/components/layout/PageLoading';
import { ActivationCard } from './ActivationCard';
import { GIcon } from '@/components/ui/GoogleIcon';

/**
 * Blocks the workspace until the server confirms an active entitlement.
 * Administrators always pass. The activation form lives here so a brand new
 * account can unlock itself without hunting through the navigation.
 */
export function PremiumGate({ children }: { children: ReactNode }) {
  const { premium, loading, error, expiresAt } = useLicense();
  const [justActivated, setJustActivated] = useState(false);

  if (premium) return <>{children}</>;
  if (loading) return <PageLoading label="Checking your subscription…" />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-6">
      <div className="w-full overflow-hidden rounded-[var(--r-card)] border border-line bg-surface shadow-[var(--elev-2)]">
        <div className="brand-gradient px-6 py-7 text-white">
          <span className="inline-flex size-12 items-center justify-center rounded-[var(--r-control)] bg-white/18">
            <GIcon name="workspace_premium" size={26} />
          </span>
          <h1 className="mt-4 text-[1.375rem] font-bold">Activate your subscription</h1>
          <p className="mt-1 max-w-md text-[0.875rem] text-white/85">
            {expiresAt ? 'Your plan has expired.' : 'A subscription is required to use the studio.'}
          </p>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger">
              <GIcon name="info" size={18} className="mt-0.5" />
              <div>
                <p className="font-semibold">We could not verify your plan.</p>
                <p className="mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {justActivated && (
            <div className="rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2.5 text-[0.8125rem] font-medium text-ok">
              Plan activated.
            </div>
          )}

          <ActivationCard onActivated={() => setJustActivated(true)} />

          <div className="grid gap-2 border-t border-line pt-4 text-[0.8125rem] text-ink-muted sm:grid-cols-2">
            <Link to="/subscription" className="flex items-center gap-2 hover:text-ink">
              <GIcon name="receipt_long" size={18} />
              Subscription details
            </Link>
            <Link to="/contact" className="flex items-center gap-2 hover:text-ink">
              <GIcon name="support_agent" size={18} />
              Need a code? Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
