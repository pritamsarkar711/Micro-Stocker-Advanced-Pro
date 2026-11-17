import { useEffect, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Field, Input } from '@/components/ui/Field';
import { PasswordMeter } from './PasswordMeter';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useToast } from '@/state/ToastState';

export type AuthView = 'signin' | 'create' | 'verify' | 'forgot' | 'reset' | 'mfa';
type View = AuthView;

const inputLeading = (name: 'mail' | 'lock' | 'person') => <GIcon name={name} size={18} />;

export function AuthForm({
  compact = false,
  onDone,
  onViewChange,
}: {
  compact?: boolean;
  onDone?: () => void;
  onViewChange?: (view: AuthView) => void;
}) {
  const {
    user,
    pendingEmail,
    notice,
    recovery,
    register,
    login,
    logout,
    mfaRequired,
    verifyMfaCode,
    verifyEmailOtp,
    resendVerification,
    requestPasswordReset,
    updatePassword,
    setPendingEmail,
    clearNotice,
    dismissRecovery,
  } = useAuth();
  const toast = useToast();

  const [view, setView] = useState<View>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // The provider decides when an address is waiting for confirmation.
  useEffect(() => {
    if (pendingEmail) {
      setEmail((current) => current || pendingEmail);
      setView('verify');
      window.setTimeout(() => otpRef.current?.focus(), 60);
    }
  }, [pendingEmail]);

  useEffect(() => {
    if (recovery) {
      setView('reset');
      setError(null);
    }
  }, [recovery]);

  useEffect(() => {
    onViewChange?.(view);
  }, [onViewChange, view]);

  useEffect(() => {
    if (mfaRequired) {
      setView('mfa');
      setError(null);
      setInfo(null);
    }
  }, [mfaRequired]);

  function switchView(next: View) {
    setError(null);
    setInfo(null);
    setView(next);
    if (next !== 'verify') setOtp('');
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error ?? 'Unable to sign in.');
        return;
      }
      setPassword('');
      if (result.mfaRequired) {
        setOtp('');
        setView('mfa');
        return;
      }
      toast.success('Signed in', result.user?.email);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleMfa(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await verifyMfaCode(otp);
      if (!result.ok) {
        setError(result.error ?? 'That code is not valid.');
        return;
      }
      setOtp('');
      toast.success('Two step verification passed');
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await register(email, password, displayName);
      if (!result.ok) {
        setError(result.error ?? 'Unable to create the account.');
        return;
      }
      setPassword('');
      if (result.needsVerification) {
        setInfo('Confirmation email sent. Enter the 6-digit code below.');
        setView('verify');
        return;
      }
      toast.success('Account created', result.user?.email);
      setEmail('');
      setDisplayName('');
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await verifyEmailOtp(pendingEmail ?? email, otp);
      if (!result.ok) {
        setError(result.error ?? 'Verification failed.');
        return;
      }
      toast.success('Email verified', 'Welcome aboard.');
      setOtp('');
      setView('signin');
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await resendVerification(pendingEmail ?? email);
      if (!result.ok) setError(result.error ?? 'Could not resend the email.');
      else setInfo('New confirmation email sent. Check your inbox and spam folder.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.ok) setError(result.error ?? 'Could not send the reset email.');
      else setInfo('If that address has an account, a reset link is on its way.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await updatePassword(newPassword);
      if (!result.ok) {
        setError(result.error ?? 'Could not update the password.');
        return;
      }
      toast.success('Password updated');
      setNewPassword('');
      dismissRecovery();
      setView('signin');
    } finally {
      setBusy(false);
    }
  }

  const banner = notice && (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-2.5 rounded-[var(--r-control)] border px-3 py-2.5 text-[0.8125rem] leading-relaxed',
        notice.tone === 'error'
          ? 'border-danger/30 bg-danger-soft text-danger'
          : notice.tone === 'ok'
            ? 'border-ok/30 bg-ok-soft text-ok'
            : 'border-line bg-surface-2 text-ink-muted',
      )}
    >
      <GIcon
        name={notice.tone === 'error' ? 'cancel' : notice.tone === 'ok' ? 'check_circle' : 'info'}
        size={17}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">{notice.message}</span>
      <button type="button" onClick={clearNotice} aria-label="Dismiss" className="text-current opacity-70 hover:opacity-100">
        <GIcon name="close" size={16} />
      </button>
    </div>
  );

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2.5 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] font-medium text-danger">
      <GIcon name="cancel" size={17} className="mt-0.5" />
      <span className="min-w-0 flex-1">{error}</span>
    </div>
  );

  const infoBox = info && (
    <div role="status" className="flex items-start gap-2.5 rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2.5 text-[0.8125rem] font-medium text-ok">
      <GIcon name="mark_email_read" size={17} className="mt-0.5" />
      <span className="min-w-0 flex-1">{info}</span>
    </div>
  );

  if (view === 'verify') {
    return (
      <div className="space-y-4">
        {banner}
        <div className="flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <GIcon name="mark_email_unread" size={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[1.0625rem] font-bold text-ink">Verify your email</h2>
            <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-muted">
              We sent a code to <span className="font-semibold text-ink">{pendingEmail ?? email}</span>.
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-3.5">
          <Field label="6-digit code" hint="The code is in the confirmation email. It can take a minute to arrive.">
            <Input
              ref={otpRef}
              aria-label="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="text-center text-lg font-bold tracking-[0.5em]"
              maxLength={10}
            />
          </Field>
          {errorBox}
          {infoBox}
          <Button type="submit" block loading={busy} icon={<GIcon name="verified" size={18} />}>
            Verify email
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
          <button type="button" onClick={() => void handleResend()} className="font-semibold text-brand-fg hover:underline" disabled={busy}>
            Resend email
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingEmail(null);
              switchView('signin');
            }}
            className="text-ink-muted hover:text-ink"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (view === 'mfa') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-[1.0625rem] font-bold text-ink">Two step verification</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Enter the 6 digit code from your authenticator app.</p>
        </div>
        <form onSubmit={handleMfa} className="space-y-3.5">
          <Field label="Code">
            <Input
              value={otp}
              aria-label="Code"
              onChange={(event) => setOtp(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              leading={<GIcon name="verified" size={18} />}
              autoFocus
            />
          </Field>
          {errorBox}
          <Button type="submit" block size="lg" loading={busy}>
            Verify
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            void logout();
            switchView('signin');
          }}
          className="text-[0.8125rem] text-ink-muted hover:text-ink"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-[1.0625rem] font-bold text-ink">Reset password</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">We will email you a secure reset link.</p>
        </div>
        <form onSubmit={handleForgot} className="space-y-3.5">
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              leading={inputLeading('mail')}
            />
          </Field>
          {errorBox}
          {infoBox}
          <Button type="submit" block loading={busy}>Send reset link</Button>
        </form>
        <button type="button" onClick={() => switchView('signin')} className="text-[0.8125rem] text-ink-muted hover:text-ink">
          Back to sign in
        </button>
      </div>
    );
  }

  if (view === 'reset') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-[1.0625rem] font-bold text-ink">Choose a new password</h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Minimum 8 characters.</p>
        </div>
        <form onSubmit={handleReset} className="space-y-3.5">
          <Field label="New password">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter a new password"
              leading={inputLeading('lock')}
            />
            <PasswordMeter value={newPassword} className="mt-1.5" />
          </Field>
          {errorBox}
          <Button type="submit" block loading={busy}>Update password</Button>
        </form>
        {user && (
          <button type="button" onClick={() => { dismissRecovery(); onDone?.(); }} className="text-[0.8125rem] text-ink-muted hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', compact && 'space-y-3.5')}>
      {banner}
      <div className="grid grid-cols-2 gap-1 rounded-[var(--r-control)] bg-surface-3/70 p-1" role="tablist" aria-label="Account access">
        {(
          [
            { id: 'signin' as const, label: 'Sign in', icon: 'login' as const },
            { id: 'create' as const, label: 'Create account', icon: 'person_add' as const },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => switchView(tab.id)}
            className={clsx(
              'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--r-chip)] text-[0.8125rem] font-semibold transition-colors',
              view === tab.id ? 'bg-surface text-ink shadow-[var(--elev-1)]' : 'text-ink-muted hover:text-ink',
            )}
          >
            <GIcon name={tab.icon} size={17} />
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={view === 'create' ? handleCreate : handleSignIn} className="space-y-3.5">
        {view === 'create' && (
          <Field label="Name" hint="Optional">
            <Input
              type="text"
              autoComplete="name"
              aria-label="Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Studio or contributor name"
              leading={inputLeading('person')}
            />
          </Field>
        )}

        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            leading={inputLeading('mail')}
          />
        </Field>

        <Field label="Password" hint={view === 'create' ? 'Minimum 8 characters.' : undefined}>
          <Input
            type={showPassword ? 'text' : 'password'}
            aria-label="Password"
            required
            minLength={view === 'create' ? 8 : undefined}
            autoComplete={view === 'create' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            leading={inputLeading('lock')}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-[var(--r-xs)] text-ink-muted hover:bg-surface-2 hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <GIcon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
              </button>
            }
          />
          {view === 'create' && <PasswordMeter value={password} className="mt-1.5" />}
        </Field>

        {errorBox}
        {infoBox}

        <Button
          type="submit"
          block
          size="lg"
          loading={busy}
          icon={<GIcon name={view === 'create' ? 'person_add' : 'login'} size={18} />}
        >
          {view === 'create' ? 'Register and sign in' : 'Sign in'}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
        <button type="button" onClick={() => switchView('forgot')} className="text-ink-muted hover:text-ink">
          Forgot password?
        </button>
        <button
          type="button"
          onClick={() => {
            setView('verify');
            setError(null);
          }}
          className="font-semibold text-brand-fg hover:underline"
        >
          I have a code
        </button>
      </div>
    </div>
  );
}
