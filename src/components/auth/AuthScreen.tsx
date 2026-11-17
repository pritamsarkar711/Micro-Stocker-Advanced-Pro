import { Logo } from '@/components/layout/Logo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { AuthForm } from './AuthForm';
import { demoMode } from '@/lib/cloud/demo';

const HIGHLIGHTS = [
  { icon: 'smart_toy' as const, title: 'AI metadata', copy: 'Titles, keywords and categories for 14 marketplaces.' },
  { icon: 'photo_size_select_large' as const, title: 'Studio tools', copy: 'Upscale, cut out and convert without leaving the app.' },
  { icon: 'upload_file' as const, title: 'Clean exports', copy: 'Agency CSV plus lossless IPTC and XMP embedding.' },
];

/**
 * Full-screen sign-in surface. Replaces the old blocking modal so there is a
 * proper place for verification codes, resend actions and password recovery.
 */
export function AuthScreen() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel */}
      <section className="surface-glow hidden flex-col justify-between bg-surface p-10 lg:flex xl:p-14">
        <Logo size={40} showWordmark />

        <div className="max-w-lg">
          <h1 className="display text-[2.25rem] leading-[1.15] font-bold tracking-[-0.02em] text-ink xl:text-[2.5rem]">
            The contributor studio for
            <span className="block text-brand">serious stock portfolios.</span>
          </h1>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">
            One workspace for metadata, export, upscaling and cutouts — on your machine.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3.5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-brand-soft text-brand">
                  <GIcon name={item.icon} size={21} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-bold text-ink">{item.title}</span>
                  <span className="block text-[0.8125rem] text-ink-muted">{item.copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[0.75rem] text-ink-faint">
          © {new Date().getFullYear()} Micro Stocker Advanced Pro
        </p>
      </section>

      {/* Form panel */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="mb-6 flex flex-col items-center gap-2 lg:hidden">
          <Logo size={44} showWordmark />
          <p className="text-center text-[0.8125rem] text-ink-muted">Your microstock studio, end to end.</p>
        </div>

        <div
          role="dialog"
          aria-label="Sign in"
          className="w-full max-w-[26rem] rounded-[var(--r-card)] border border-line bg-surface p-5 shadow-[var(--elev-2)] sm:p-7"
        >
          <div className="mb-4">
            <h2 className="text-[1.125rem] font-bold text-ink">Welcome back</h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Sign in or create your account.</p>
          </div>
          <AuthForm />
        </div>

        {demoMode ? (
          <div className="mt-5 w-full max-w-[26rem] rounded-[var(--r-card)] border border-line bg-surface-2 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Preview build.</span> Sign in with any email and an
            8+ character password. Use <code className="font-mono text-ink">admin@demo.local</code> for the
            administrator view; <code className="font-mono text-ink">alice@demo.local</code> already has an
            active plan.
          </div>
        ) : (
          <p className="mt-5 flex items-center gap-1.5 text-center text-[0.75rem] text-ink-faint">
            <GIcon name="lock" size={14} />
            Secure sign-in handled by your licensing server.
          </p>
        )}
      </section>
    </div>
  );
}
