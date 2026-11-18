import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { Spinner } from '@/components/ui/Misc';
import { useToast } from '@/state/ToastState';
import { useAuth } from '@/state/AuthState';
import {
  adminExpireSubscriptions,
  adminResetMfa,
  adminSecurityOverview,
  isFailure,
  updateSetting,
  type AdminSecurityUser,
  type Setting,
} from '@/lib/pro/api';

/**
 * Administrator security tab: who has two step verification, the policy switch
 * and the two recovery actions an owner needs when a user loses their phone or
 * a plan outlives its expiry.
 */
export function AdminSecurity({
  settings,
  onChange,
  onSaved,
}: {
  settings: Setting[];
  onChange: () => void;
  onSaved: (message: string, detail?: string) => void;
}) {
  const toast = useToast();
  const { mfaFactor } = useAuth();
  const policy = settings.find((entry) => entry.key === 'security')?.value as { require_admin_mfa?: boolean } | undefined;
  const requireAdminMfa = Boolean(policy?.require_admin_mfa);

  const [rows, setRows] = useState<AdminSecurityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPolicy, setBusyPolicy] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [confirm, setConfirm] = useState<AdminSecurityUser | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminSecurityOverview();
    setLoading(false);
    if (isFailure(result)) {
      setError(result.error);
      return;
    }
    setError('');
    setRows(result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withoutFactor = rows.filter((row) => row.role === 'admin' && row.factors === 0);

  async function togglePolicy(next: boolean) {
    setBusyPolicy(true);
    const result = await updateSetting('security', { require_admin_mfa: next });
    setBusyPolicy(false);
    if (isFailure(result)) {
      toast.error('Could not change the policy', result.error);
      return;
    }
    onSaved(next ? 'Administrators must use two step verification' : 'Two step verification is optional for admins');
    onChange();
  }

  async function resetFactors() {
    if (!confirm) return;
    setResetting(true);
    const result = await adminResetMfa(confirm.user_id);
    setResetting(false);
    if (isFailure(result)) {
      toast.error('Could not reset', result.error);
      return;
    }
    onSaved(
      result === 0 ? 'That account had no authenticator' : 'Authenticator cleared',
      `${confirm.email ?? 'The account'} can sign in with the password and set it up again.`,
    );
    setConfirm(null);
    void load();
  }

  async function sweep() {
    setSweeping(true);
    const result = await adminExpireSubscriptions();
    setSweeping(false);
    if (isFailure(result)) {
      toast.error('Could not run the sweep', result.error);
      return;
    }
    onSaved(result === 0 ? 'No plan had expired' : `${result} plan${result === 1 ? '' : 's'} marked expired`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card flush>
        <CardHeader
          title="Two step verification"
          subtitle="A code from Google Authenticator on top of the password, for every account."
          icon={<GIcon name="verified" size={18} />}
        />
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line px-4 py-3">
          <div className="min-w-0 max-w-xl">
            <p className="text-[0.8125rem] font-medium">
              Require an authenticator for administrator accounts
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
              While this is on, an administrator without a verified authenticator cannot open the console: the sign in still
              works, but prices, payments and provider keys stay locked until the code is entered. Ordinary accounts are
              never forced to use it.
            </p>
            {!mfaFactor && (
              <p className="mt-2 flex items-start gap-1.5 text-2xs text-warn">
                <GIcon name="info" size={15} className="mt-0.5 shrink-0" />
                Your own account has no authenticator yet, so the switch will refuse to turn on. Enable it in Settings →
                Security first.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {busyPolicy && <Spinner size={4} />}
            <Switch
              checked={requireAdminMfa}
              onChange={(next) => {
                if (next && withoutFactor.length > 1) {
                  toast.info('One administrator has no code yet', 'They lose console access until they set it up.');
                }
                void togglePolicy(next);
              }}
            />
          </div>
        </div>
        {withoutFactor.length > 0 && (
          <div className="border-t border-line bg-warn-soft px-4 py-2.5 text-2xs text-ink">
            {withoutFactor.length === 1 ? '1 administrator has' : `${withoutFactor.length} administrators have`} no
            authenticator: {withoutFactor.map((row) => row.email ?? row.user_id).join(', ')}
          </div>
        )}
      </Card>

      <Card flush>
        <CardHeader
          title="Accounts"
          subtitle="Who can sign in, who has a code, and the last sign in."
          icon={<GIcon name="group" size={18} />}
          action={
            <Button size="sm" variant="ghost" onClick={() => void load()} icon={<GIcon name="refresh" size={16} />}>
              Refresh
            </Button>
          }
        />
        {error && <p className="border-t border-line px-4 py-3 text-[0.8125rem] text-danger">{error}</p>}
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-10">
            <Spinner size={6} />
          </div>
        ) : rows.length === 0 ? (
          <p className="border-t border-line px-4 py-4 text-2xs text-ink-muted">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[640px] text-[0.8125rem]">
              <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Role</th>
                  <th className="px-4 py-2 text-left font-semibold">2FA</th>
                  <th className="px-4 py-2 text-left font-semibold">Last sign in</th>
                  <th className="px-4 py-2 text-right font-semibold">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.user_id}>
                    <td className="max-w-[240px] truncate px-4 py-2 font-medium">{row.email ?? row.user_id}</td>
                    <td className="px-4 py-2">
                      <Badge tone={row.role === 'admin' ? 'brand' : 'neutral'} size="sm">
                        {row.role}
                      </Badge>
                      {row.blocked && (
                        <Badge tone="danger" size="sm">
                          blocked
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {row.factors > 0 ? (
                        <Badge tone="ok" size="sm">
                          On
                        </Badge>
                      ) : (
                        <span className="text-2xs text-ink-muted">Off</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-2xs text-ink-muted">
                      {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : 'never'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={row.factors === 0}
                        onClick={() => setConfirm(row)}
                        icon={<GIcon name="person_off" size={14} />}
                      >
                        Clear 2FA
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card flush>
        <CardHeader
          title="Housekeeping"
          subtitle="Plans stop counting as active the moment they expire, even before this runs."
          icon={<GIcon name="cleaning_services" size={18} />}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="min-w-0 max-w-lg text-2xs text-ink-muted">
            Run the expiry sweep once a day (or after a batch of approvals) so the revenue and subscriber numbers match
            reality. It never touches credits that were already granted.
          </p>
          <Button size="sm" variant="outline" loading={sweeping} onClick={() => void sweep()} icon={<GIcon name="timer" size={16} />}>
            Run expiry sweep
          </Button>
        </div>
      </Card>

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          size="sm"
          title="Clear two step verification?"
          description={`${confirm.email ?? 'This account'} will be able to sign in with the password only until they set up a new authenticator.`}
        >
          <div className="space-y-3">
            <p className="text-[0.8125rem] text-ink-muted">
              Use this when a user loses their phone. It is written to the audit log with your account as the actor.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" loading={resetting} onClick={() => void resetFactors()}>
                Clear 2FA
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
