import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useToast } from '@/state/ToastState';
import { dateTime } from '@/lib/format';

export function AuthModal({ required = false }: { required?: boolean }) {
  const {
    user,
    modalOpen,
    modalMode,
    openAuth,
    closeAuth,
    register,
    login,
    updateDisplayName,
    logout,
  } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!modalOpen) return;
    setError(null);
    setPassword('');
    if (modalMode === 'register') setTab('register');
    else if (modalMode === 'login') setTab('login');
    if (user) setEditName(user.displayName);
  }, [modalOpen, modalMode, user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        tab === 'register'
          ? await register(email, password, displayName)
          : await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        tab === 'register' ? 'Account created and signed in' : 'Signed in',
        result.user.email,
      );
      setEmail('');
      setPassword('');
      setDisplayName('');
      closeAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (user && modalMode === 'account') {
    return (
      <Modal
        open={modalOpen}
        onClose={closeAuth}
        title="Account"
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">Contact support to delete your account.</span>
            <Button
              variant="secondary"
              size="sm"
              icon={<GIcon name="logout" size={16} />}
              onClick={async () => {
                await logout();
                toast.info('Signed out');
                closeAuth();
              }}
            >
              Sign out
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[var(--r-control)] border border-line bg-surface-2/60 p-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-brand">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{user.displayName}</div>
              <div className="truncate text-xs text-ink-muted">{user.email}</div>
            </div>
            <Badge tone="brand">Active</Badge>
          </div>

          <Field label="Display name">
            <div className="flex gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!editName.trim() || editName.trim() === user.displayName}
                onClick={async () => {
                  try {
                    await updateDisplayName(editName);
                    toast.success('Display name saved');
                  } catch (err) {
                    toast.error('Could not save display name', err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Save
              </Button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
            <div className="rounded-[var(--r-control)] border border-line p-2.5">
              <div className="font-medium text-ink-faint">Joined</div>
              <div className="mt-0.5 font-medium text-ink">{dateTime(user.createdAt)}</div>
            </div>
            <div className="rounded-[var(--r-control)] border border-line p-2.5">
              <div className="font-medium text-ink-faint">Storage</div>
              <div className="mt-0.5 font-medium text-ink">
                {user.syncedToCloud ? 'Cloud & device' : 'This device'}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={required || modalOpen}
      onClose={closeAuth}
      dismissible={!required}
      title={tab === 'register' ? 'Create account' : 'Sign in'}
      description={
        tab === 'register'
          ? 'Create an account. Email confirmation may be required before signing in.'
          : 'Sign in with your email and password.'
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
              openAuth('login');
            }}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-[5px] text-xs font-semibold ${
              tab === 'login'
                ? 'bg-accent text-on-brand shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <GIcon name="login" size={15} />
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
              openAuth('register');
            }}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-[5px] text-xs font-semibold ${
              tab === 'register'
                ? 'bg-accent text-on-brand shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <GIcon name="person_add" size={15} />
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'register' && (
            <Field label="Name (optional)">
              <Input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Studio or contributor name"
                leading={<GIcon name="person" size={16} />}
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              leading={<GIcon name="mail" size={16} />}
            />
          </Field>

          <Field label="Password" hint={tab === 'register' ? 'Minimum 8 characters' : undefined}>
            <Input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={tab === 'register' ? 8 : undefined}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              leading={<GIcon name="lock" size={16} />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="pointer-events-auto text-ink-muted hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <GIcon name={showPassword ? 'visibility_off' : 'visibility'} size={16} />
                </button>
              }
            />
          </Field>

          {error && (
            <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              <GIcon name="error" size={15} />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={busy}
            icon={<GIcon name={tab === 'register' ? 'person_add' : 'login'} size={16} />}
          >
            {tab === 'register' ? 'Register and sign in' : 'Sign in'}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
