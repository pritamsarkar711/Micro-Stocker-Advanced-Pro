
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useLicense } from '@/state/LicenseState';
import { useAuth } from '@/state/AuthState';
import { dateTime } from '@/lib/format';

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SubscriptionPage() {
  const { loading, premium, isAdmin, isBlocked, expiresAt, remainingMs, error, refresh } = useLicense();
  const { user } = useAuth();

  const status = isBlocked ? 'Blocked' : isAdmin ? 'Administrator' : premium ? 'Active' : 'Inactive';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscription"
        description="Activate a code to unlock the studio."
        actions={
          <Button size="sm" variant="outline" icon={<GIcon name="refresh" size={18} />} onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card padding="none" className="overflow-hidden">
          <div
            className={
              premium || isAdmin
                ? 'brand-gradient px-5 py-6 text-white'
                : 'bg-surface-3 px-5 py-6 text-ink'
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.75rem] font-semibold tracking-[0.14em] uppercase">
                  Current plan
                </div>
                <div className="mt-1.5 text-[1.75rem] leading-none font-bold">{status}</div>
                <div className="mt-2 text-[0.875rem]">{user?.email}</div>
              </div>
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-white/18">
                <GIcon name={isAdmin ? 'admin_panel_settings' : 'workspace_premium'} size={26} />
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-[0.8125rem]">
              <div>
                <div>Expires</div>
                <div className="mt-0.5 font-semibold">
                  {isAdmin ? 'Never' : expiresAt ? dateTime(expiresAt) : 'Not set'}
                </div>
              </div>
              <div>
                <div>Time left</div>
                <div className="mt-0.5 font-semibold">
                  {loading ? 'Checking…' : isAdmin ? 'Unlimited' : remainingMs > 0 ? countdown(remainingMs) : 'Not set'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5">
            {error && (
              <div className="flex items-start gap-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                <GIcon name="info" size={17} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isBlocked ? 'danger' : premium ? 'ok' : 'warn'} dot>
                {isBlocked ? 'Access disabled' : premium ? 'Full access' : 'Activation required'}
              </Badge>
              {expiresAt && !isAdmin && (
                <Badge tone="neutral">Renews by code</Badge>
              )}
            </div>
            <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
              {isAdmin
                ? 'Administrator accounts have unrestricted access and can issue codes from the admin console.'
                : premium
                  ? 'Add another code at any time. Remaining time is kept and new time is added on top.'
                  : 'Enter the code from your administrator to unlock every tool.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {isAdmin && (
                <ButtonLink to="/admin" size="sm" icon={<GIcon name="settings" size={18} />}>
                  Admin console
                </ButtonLink>
              )}
              <ButtonLink to="/contact" size="sm" variant="outline" icon={<GIcon name="support_agent" size={18} />}>
                Support
              </ButtonLink>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Everyday tools stay free" icon={<GIcon name="check_circle" size={18} />} />
          <div className="space-y-2 text-[0.8125rem] text-ink-muted">
            {['Converter, optimiser and background remover', 'Standard upscale models', 'Vector Studio and general tools'].map((line) => (
              <div key={line} className="flex items-center gap-2">
                <GIcon name="check_circle" size={17} className="text-ok" />
                {line}
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-line pt-4 text-[0.8125rem] text-ink-muted">
            A subscription only unlocks the premium generators, the JPG studio and the top upscale models.
          </p>
        </Card>
      </div>
    </div>
  );
}
