import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';

/**
 * Security states that must stay visible even when the account panel is closed:
 * an unclaimed password reset, a pending authenticator code and a reset link
 * that could not be exchanged in this browser. Without this banner the only
 * way back into those screens is guessing that the avatar menu reopens them.
 */
export function SecurityBanner() {
  const { recovery, recoveryError, mfaRequired, openAuth, clearRecoveryError } = useAuth();

  if (!recovery && !mfaRequired && !recoveryError) return null;

  const tone = recoveryError && !recovery && !mfaRequired ? 'danger' : 'brand';
  const message = recovery
    ? 'Your reset link worked. Choose a new password to finish.'
    : mfaRequired
      ? 'Two step verification is on for this account. Enter the 6 digit code to continue.'
      : recoveryError;
  const action = recovery ? 'Set new password' : mfaRequired ? 'Enter code' : 'Try again';

  return (
    <div
      role="status"
      className={
        tone === 'danger'
          ? 'mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger'
          : 'mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--r-control)] border border-brand/30 bg-brand-soft px-3 py-2.5 text-[0.8125rem] text-brand-fg'
      }
    >
      <GIcon name={tone === 'danger' ? 'link_off' : mfaRequired ? 'verified' : 'lock'} size={18} />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={() => {
          clearRecoveryError();
          openAuth('login');
        }}
        className="shrink-0 rounded-[var(--r-chip)] bg-surface px-2.5 py-1 text-2xs font-semibold text-ink shadow-[var(--elev-1)] hover:bg-surface-2"
      >
        {action}
      </button>
    </div>
  );
}
