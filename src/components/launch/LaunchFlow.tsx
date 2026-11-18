import { useEffect, useState } from 'react';
import { GIcon } from '@/components/ui/GoogleIcon';
import { Logo } from '@/components/layout/Logo';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/state/AuthState';
import { licenseConfigured } from '@/lib/cloud/licensing';
import { demoMode } from '@/lib/cloud/demo';
import { launch } from '@/lib/launch';
import { SplashScreen } from './SplashScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { Onboarding } from './Onboarding';

/**
 * Registration and sign-in as the last step of the launch flow. It is a full
 * screen rather than a dialog because on a phone a modal over an unloaded
 * dashboard has nothing to sit on.
 */
export function LaunchAuth({ onBack, onGuest }: { onBack: () => void; onGuest?: () => void }) {
  return (
    <div className="launch-screen flex h-dvh w-full flex-col bg-bg">
      <div className="flex items-center justify-between px-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <button type="button" onClick={onBack} className="launch-icon-button" aria-label="Back to the tour">
          <GIcon name="arrow_forward" size={20} className="rotate-180" />
        </button>
        <Logo size={26} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6">
        <div className="mx-auto w-full max-w-[27rem]">
          <h1 className="display text-center text-[1.625rem] leading-tight font-bold tracking-[-0.02em] text-ink">
            Your studio, signed in
          </h1>
          <p className="mt-1.5 text-center text-[0.875rem] leading-relaxed text-ink-muted">
            Credits, plans and workspace settings follow this account on every device.
          </p>

          <div className="mt-5 rounded-[var(--r-card)] border border-line bg-surface p-4 shadow-[var(--elev-2)] sm:p-6">
            <AuthForm />
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-2xs text-ink-faint">
            <GIcon name="lock" size={13} />
            8 characters minimum · encrypted in transit
          </p>

          {onGuest && !licenseConfigured && (
            <button type="button" onClick={onGuest} className="launch-secondary mt-3">
              Continue without an account
            </button>
          )}

          {demoMode && (
            <p className="mt-4 rounded-[var(--r-control)] border border-line bg-surface-2 px-3 py-2 text-2xs leading-relaxed text-ink-muted">
              Preview build: any email with an 8 character password works. Use{' '}
              <code className="font-mono text-ink">admin@demo.local</code> for the console.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type Stage = 'splash' | 'welcome' | 'tour' | 'auth';

export function LaunchFlow({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('splash');
  const [done, setDone] = useState(false);

  const enterApp = () => {
    launch.complete();
    setDone(true);
    onDone();
  };

  // Signing in or registering anywhere inside the flow finishes it.
  useEffect(() => {
    if (!user || done || stage === 'splash') return;
    launch.complete();
    setDone(true);
    onDone();
  }, [user, done, stage, onDone]);

  if (done) return null;

  if (stage === 'splash') {
    return (
      <SplashScreen
        onDone={() => {
          if (launch.isComplete()) {
            if (user) {
              launch.complete();
              setDone(true);
              onDone();
              return;
            }
            setStage('auth');
            return;
          }
          setStage(launch.hasSeenTour() ? 'auth' : 'welcome');
        }}
      />
    );
  }

  if (stage === 'welcome') {
    return <WelcomeScreen onStart={() => setStage('tour')} onSignIn={() => setStage('auth')} />;
  }

  if (stage === 'tour') {
    return (
      <Onboarding
        onFinish={() => setStage('auth')}
        onSkip={() => {
          launch.markTourSeen();
          setStage('auth');
        }}
        onBack={() => setStage('welcome')}
      />
    );
  }

  return <LaunchAuth onBack={() => setStage('tour')} onGuest={enterApp} />;
}
