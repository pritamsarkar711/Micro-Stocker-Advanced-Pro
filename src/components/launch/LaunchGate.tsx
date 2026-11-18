import { useState, type ReactNode } from 'react';
import { LaunchFlow } from './LaunchFlow';

/**
 * Holds the studio back until the launch flow has played: splash, welcome,
 * tour, then register or sign in. The dashboard only mounts once that is done,
 * so nothing behind the flow can flash or fetch before an account exists.
 */
export function LaunchGate({ children }: { children: ReactNode }) {
  const [launched, setLaunched] = useState(false);
  if (!launched) return <LaunchFlow onDone={() => setLaunched(true)} />;
  return <>{children}</>;
}
