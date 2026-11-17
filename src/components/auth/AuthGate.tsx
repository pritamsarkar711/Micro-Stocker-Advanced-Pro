import type { ReactNode } from 'react';
import { useAuth } from '@/state/AuthState';
import { licenseConfigured } from '@/lib/cloud/licensing';
import { AuthScreen } from './AuthScreen';
import { Logo } from '@/components/layout/Logo';
import { GIcon } from '@/components/ui/GoogleIcon';

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg text-ink">
        <Logo size={48} />
        <div className="flex items-center gap-2 text-[0.875rem] text-ink-muted">
          <GIcon name="progress_activity" size={18} className="animate-spin" />
          Checking your account…
        </div>
      </div>
    );
  }

  if (!licenseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink">
        <div className="w-full max-w-md rounded-[var(--r-card)] border border-line bg-surface p-6 shadow-[var(--elev-2)]">
          <Logo size={40} className="mb-4" />
          <h1 className="text-lg font-bold">Service not configured</h1>
          <p className="mt-2 text-[0.875rem] text-ink-muted">
            This build is not connected to a licensing server. Set <code>VITE_LICENSE_SUPABASE_URL</code> and{' '}
            <code>VITE_LICENSE_SUPABASE_ANON_KEY</code>, then rebuild.
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return <>{children}</>;
}
