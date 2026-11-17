import type { ReactNode } from 'react';
import { useAuth } from '@/state/AuthState';
import { licenseConfigured } from '@/lib/cloud/licensing';
import { AuthModal } from './AuthModal';

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  if (!ready) return <div className="flex min-h-dvh items-center justify-center bg-bg text-ink">Checking your account…</div>;
  if (!licenseConfigured) return <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink"><div className="max-w-md rounded border border-line bg-surface p-6"><h1 className="text-lg">Service not configured</h1><p className="mt-2 text-sm text-ink-muted">This build is not connected to the licensing service. Please contact the application administrator.</p></div></div>;
  if (!user) return <div className="min-h-dvh bg-bg"><AuthModal required /></div>;
  return <>{children}</>;
}
