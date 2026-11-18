import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useLicense } from '@/state/LicenseState';
import { useToast } from '@/state/ToastState';
import { date } from '@/lib/format';
import { AuthForm } from './AuthForm';

export function AuthModal() {
  const { user, modalOpen, closeAuth, updateDisplayName, logout, mfaRequired, recovery, recoveryError } = useAuth();
  const { premium, isAdmin, expiresAt } = useLicense();
  const toast = useToast();
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (modalOpen && user) setEditName(user.displayName);
  }, [modalOpen, user]);

  // A reset link signs the browser in with a recovery session, so the account
  // panel would hide the only form that can set a new password. Same for a
  // session that still owes an authenticator code.
  const needsForm = !user || recovery || mfaRequired;
  if (needsForm) {
    return (
      <Modal
        open={modalOpen}
        onClose={closeAuth}
        title={recovery ? 'Choose a new password' : mfaRequired ? 'Two step verification' : 'Account'}
        size="sm"
      >
        {recoveryError && !recovery && (
          <div role="alert" className="mb-3 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger">
            {recoveryError}
          </div>
        )}
        <AuthForm compact onDone={closeAuth} />
      </Modal>
    );
  }

  return (
    <Modal
      open={modalOpen}
      onClose={closeAuth}
      title="Account"
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Link to="/about" onClick={closeAuth} className="text-[0.75rem] text-ink-muted hover:text-ink">
            About this build
          </Link>
          <Button
            variant="secondary"
            size="sm"
            icon={<GIcon name="logout" size={17} />}
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
        <div className="flex items-center gap-3 rounded-[var(--r-control)] border border-line bg-surface-2 p-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[0.9375rem] font-bold text-on-brand">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.875rem] font-semibold text-ink">{user.displayName}</div>
            <div className="truncate text-[0.75rem] text-ink-muted">{user.email}</div>
          </div>
          <Badge tone={isAdmin ? 'brand' : premium ? 'ok' : 'danger'}>{isAdmin ? 'Admin' : premium ? 'Active' : 'Inactive'}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
          <div className="rounded-[var(--r-control)] border border-line p-2.5">
            <div className="text-ink-faint">Joined</div>
            <div className="mt-0.5 font-semibold text-ink">{date(user.createdAt)}</div>
          </div>
          <div className="rounded-[var(--r-control)] border border-line p-2.5">
            <div className="text-ink-faint">Plan expires</div>
            <div className="mt-0.5 font-semibold text-ink">
              {isAdmin ? 'Never' : expiresAt ? date(expiresAt) : 'Not set'}
            </div>
          </div>
        </div>

        <Link
          to={isAdmin ? '/admin' : '/subscription'}
          onClick={closeAuth}
          className="flex items-center justify-between gap-2 rounded-[var(--r-control)] border border-line px-3 py-2.5 text-[0.8125rem] font-semibold text-ink hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <span className="flex items-center gap-2">
            <GIcon name={isAdmin ? 'admin_panel_settings' : 'workspace_premium'} size={18} className="text-brand" />
            {isAdmin ? 'Open admin console' : premium ? 'Manage subscription' : 'Activate a plan'}
          </span>
          <GIcon name="chevron_right" size={18} className="text-ink-faint" />
        </Link>

        <Field label="Display name">
          <div className="flex gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" maxLength={60} />
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              disabled={!editName.trim() || editName.trim() === user.displayName}
              onClick={async () => {
                setBusy(true);
                try {
                  await updateDisplayName(editName);
                  toast.success('Display name saved');
                } catch (err) {
                  toast.error('Could not save display name', err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
