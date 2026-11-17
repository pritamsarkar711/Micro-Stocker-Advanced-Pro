import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/state/AuthState';
import { useLicense } from '@/state/LicenseState';

/** Check the account on the server before mounting the workspace. */
export function AccountGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { loading, verified, isBlocked, refresh } = useLicense();
  const hasOpened = useRef(false);
  const allowed = verified && !isBlocked;
  if (allowed) hasOpened.current = true;
  return <>
    {hasOpened.current && <div hidden={!allowed} inert={!allowed}>{children}</div>}
    {!allowed && <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink"><div className="w-full max-w-md rounded-card border border-line bg-surface p-6">
      <h1 className="text-lg">{loading ? 'Checking your account…' : isBlocked ? 'Account disabled' : 'Unable to verify account'}</h1>
      <p className="mt-2 text-sm text-ink-muted">{loading ? 'Please wait.' : isBlocked ? 'Contact the administrator for assistance.' : 'Check your internet connection and try again. Account verification is required.'}</p>
      {!loading && <div className="mt-4 flex gap-2"><Button onClick={() => void refresh()}>Try again</Button><Button variant="outline" onClick={() => void logout()}>Sign out</Button></div>}
    </div></div>}
  </>;
}
