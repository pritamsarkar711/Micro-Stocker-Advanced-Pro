import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/state/AuthState';
import { LaunchFlow } from './LaunchFlow';

/**
 * Holds the studio back until the launch flow has played: splash, welcome,
 * tour, then register or sign in. The dashboard only mounts once that is done,
 * so nothing behind the flow can flash or fetch before an account exists.
 */
export function LaunchGate({ children }: { children: ReactNode }) {
  const [launched, setLaunched] = useState(false);
  // Signing out of a running session puts the studio back behind the sign-in
  // screen instead of leaving an anonymous dashboard on screen.
  const [signedOut, setSignedOut] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!launched || user) return;
    setSignedOut(true);
    setLaunched(false);
  }, [launched, user]);

  if (!launched) return <LaunchFlow onDone={() => setLaunched(true)} resumeAtAuth={signedOut} />;
  return <>{children}</>;
}
