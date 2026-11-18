import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLicense } from '@/state/LicenseState';
import { useAuth } from '@/state/AuthState';
import { PageLoading } from '@/components/layout/PageLoading';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';

/**
 * Wraps the premium generators. Everything else in the studio stays open, so
 * this is the only place a subscription is enforced in the interface (the server
 * enforces the same rule again before a single credit is spent).
 */
export function PremiumGate({ children, feature }: { children: ReactNode; feature?: 'vector' | 'jpg' }) {
  const { premium, loading, hasFeature } = useLicense();
  const { user, openAuth } = useAuth();
  const allowed = feature ? hasFeature(feature) : premium;

  if (allowed) return <>{children}</>;
  if (loading) return <PageLoading label="Checking your plan…" />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center py-6">
      <div className="w-full overflow-hidden rounded-[var(--r-card)] border border-line bg-surface shadow-[var(--elev-2)]">
        <div className="brand-gradient px-6 py-7 text-white">
          <span className="inline-flex size-12 items-center justify-center rounded-[var(--r-control)] bg-white/18">
            <GIcon name="workspace_premium" size={26} />
          </span>
          <h1 className="mt-4 text-[1.375rem] font-bold">This tool is part of Pro</h1>
          <p className="mt-1 max-w-md text-[0.875rem] text-white/85">
            The generators and the premium upscale models are included with an active subscription. Every other tool in the studio stays free.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <ul className="grid gap-2 text-[0.8125rem] text-ink-muted sm:grid-cols-2">
            <li className="flex items-center gap-2"><GIcon name="check" size={18} className="text-ok" />EPS, SVG and AI generators</li>
            <li className="flex items-center gap-2"><GIcon name="check" size={18} className="text-ok" />Premium upscale models</li>
            <li className="flex items-center gap-2"><GIcon name="check" size={18} className="text-ok" />JPG image studio</li>
            <li className="flex items-center gap-2"><GIcon name="check" size={18} className="text-ok" />Metadata and quality checks</li>
          </ul>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link to="/subscription">
              <Button icon={<GIcon name="workspace_premium" size={18} />}>See plans</Button>
            </Link>
            {!user && (
              <Button variant="outline" onClick={() => openAuth('login')} icon={<GIcon name="login" size={18} />}>
                Sign in
              </Button>
            )}
            <Link to="/contact" className="flex items-center gap-2 px-1 text-[0.8125rem] text-ink-muted hover:text-ink">
              <GIcon name="support_agent" size={18} />
              Need help?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
