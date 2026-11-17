import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth, type MfaEnrollment } from '@/state/AuthState';
import { useToast } from '@/state/ToastState';

/**
 * Password and two step verification controls. Shared by the Settings page and
 * available to every account role, administrators included.
 */
export function SecurityPanel() {
  const {
    user,
    mfaFactor,
    changePassword,
    requestPasswordReset,
    enrollTotp,
    confirmTotp,
    disableTotp,
    signOutEverywhere,
    refreshMfa,
  } = useAuth();
  const toast = useToast();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [showDisable, setShowDisable] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (user) void refreshMfa();
  }, [refreshMfa, user]);

  if (!user) {
    return <p className="text-[0.8125rem] text-ink-muted">Sign in to manage password and two step verification.</p>;
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (next !== repeat) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changePassword(current, next);
      if (!result.ok) {
        setPasswordError(result.error ?? 'Could not change the password.');
        return;
      }
      setCurrent('');
      setNext('');
      setRepeat('');
      setPasswordOpen(false);
      toast.success('Password updated');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function startEnrollment() {
    setTotpError(null);
    setTotpBusy(true);
    try {
      const result = await enrollTotp();
      if (!result.ok || !result.enrollment) {
        setTotpError(result.error ?? 'Could not start setup.');
        return;
      }
      setEnrollment(result.enrollment);
    } finally {
      setTotpBusy(false);
    }
  }

  async function submitTotp(event: FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setTotpError(null);
    setTotpBusy(true);
    try {
      const result = await confirmTotp(enrollment.factorId, totpCode);
      if (!result.ok) {
        setTotpError(result.error ?? 'That code is not valid.');
        return;
      }
      setEnrollment(null);
      setTotpCode('');
      toast.success('Two step verification is on');
      await refreshMfa();
    } finally {
      setTotpBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (enrollment) await disableTotp(enrollment.factorId);
    setEnrollment(null);
    setTotpCode('');
    setTotpError(null);
  }

  async function turnOff() {
    if (!mfaFactor) return;
    setTotpBusy(true);
    try {
      const result = await disableTotp(mfaFactor.id);
      if (!result.ok) {
        toast.error('Could not turn it off', result.error);
        return;
      }
      setShowDisable(false);
      toast.success('Two step verification is off');
      await refreshMfa();
    } finally {
      setTotpBusy(false);
    }
  }

  async function sendReset() {
    setResetBusy(true);
    try {
      const email = user?.email ?? '';
      const result = await requestPasswordReset(email);
      if (result.ok) toast.success('Reset link sent', email);
      else toast.error('Could not send the link', result.error);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Password */}
      <div className="rounded-[var(--r-control)] border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <GIcon name="lock" size={17} className="text-ink-muted" />
            <div className="min-w-0">
              <div className="text-[0.8125rem] font-semibold text-ink">Password</div>
              <div className="truncate text-[0.75rem] text-ink-muted">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => void sendReset()} loading={resetBusy}>
              Email reset link
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                setPasswordOpen((open) => !open);
                setPasswordError(null);
              }}
            >
              {passwordOpen ? 'Close' : 'Change'}
            </Button>
          </div>
        </div>

        {passwordOpen && (
          <form onSubmit={submitPassword} className="space-y-2.5 border-t border-line px-3 py-3">
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                aria-label="Current password"
                required
              />
            </Field>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="New password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  aria-label="New password"
                  required
                  minLength={8}
                />
              </Field>
              <Field label="Repeat new password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  aria-label="Repeat new password"
                  required
                  minLength={8}
                />
              </Field>
            </div>
            {passwordError && <p className="text-[0.75rem] font-medium text-danger">{passwordError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" loading={passwordBusy}>
                Save password
              </Button>
              <span className="text-[0.75rem] text-ink-faint">At least 8 characters</span>
            </div>
          </form>
        )}
      </div>

      {/* Two step verification */}
      <div className="rounded-[var(--r-control)] border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <GIcon name="verified" size={17} className="text-ink-muted" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
                Two step verification
                <Badge tone={mfaFactor ? 'ok' : 'neutral'} size="sm">
                  {mfaFactor ? 'On' : 'Off'}
                </Badge>
              </div>
              <div className="truncate text-[0.75rem] text-ink-muted">
                {mfaFactor ? mfaFactor.friendlyName : 'Authenticator app'}
              </div>
            </div>
          </div>
          {!enrollment && (
            <Button
              size="xs"
              variant={mfaFactor ? 'ghost' : 'secondary'}
              onClick={() => (mfaFactor ? setShowDisable(true) : void startEnrollment())}
              loading={totpBusy && !mfaFactor}
            >
              {mfaFactor ? 'Turn off' : 'Enable'}
            </Button>
          )}
        </div>

        {showDisable && mfaFactor && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
            <span className="text-[0.75rem] text-ink-muted">Turn off two step verification?</span>
            <div className="flex gap-1.5">
              <Button size="xs" variant="danger" loading={totpBusy} onClick={() => void turnOff()}>
                Turn off
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setShowDisable(false)}>
                Keep
              </Button>
            </div>
          </div>
        )}

        {enrollment && (
          <form onSubmit={submitTotp} className="space-y-3 border-t border-line px-3 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {enrollment.qr && (
                <img
                  src={enrollment.qr}
                  alt="Authenticator QR code"
                  className="size-32 shrink-0 rounded-[var(--r-control)] border border-line bg-white p-1"
                />
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-[0.75rem] text-ink-muted">
                  {enrollment.qr ? 'Scan the code, then enter the 6 digit code.' : 'Add this key to your authenticator app.'}
                </p>
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 truncate rounded-[var(--r-xs)] border border-line bg-surface-2 px-1.5 py-1 text-[0.75rem] tracking-[0.08em] text-ink">
                    {enrollment.secret}
                  </code>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(enrollment.secret);
                      toast.success('Key copied');
                    }}
                    aria-label="Copy key"
                  >
                    <GIcon name="content_copy" size={14} />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="6 digit code" className="w-32">
                <Input
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  aria-label="6 digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </Field>
              <Button type="submit" size="sm" loading={totpBusy}>
                Verify
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void cancelEnrollment()}>
                Cancel
              </Button>
            </div>
            {totpError && <p className="text-[0.75rem] font-medium text-danger">{totpError}</p>}
          </form>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.75rem] text-ink-muted">Signed in on this device</span>
        <Button
          size="xs"
          variant="ghost"
          icon={<GIcon name="logout" size={14} />}
          onClick={() => {
            void signOutEverywhere().then((result) => {
              if (!result.ok) toast.error('Could not sign out everywhere', result.error);
            });
          }}
        >
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
