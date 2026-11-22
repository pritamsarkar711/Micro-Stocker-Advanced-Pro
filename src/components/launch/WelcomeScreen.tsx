import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { Logo } from '@/components/layout/Logo';
import { appName } from '@/lib/version';

/**
 * The hand-off between the splash and the tour. It answers three questions in
 * the first screen: what this is, who it is for and what happens next.
 */
export function WelcomeScreen({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const highlights: Array<{ icon: GoogleIconName; title: string; copy: string }> = [
    { icon: 'edit_note', title: 'Metadata that sells', copy: 'Titles and keywords drafted from the picture itself.' },
    { icon: 'upload_file', title: '14 marketplaces', copy: 'Exact CSV and IPTC exports, no reformatting.' },
    { icon: 'memory', title: 'Tools on the device', copy: 'Upscale, cut out, convert, even without a signal.' },
  ];

  return (
    <div className="launch-screen relative flex h-dvh w-full flex-col overflow-hidden bg-bg">
      <div aria-hidden="true" className="launch-hero" />

      <div className="relative flex min-h-0 flex-1 flex-col justify-between px-5 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-bold text-ink">{appName()}</p>
            <p className="truncate text-2xs text-ink-muted">Contributor studio</p>
          </div>
        </div>

        <div className="launch-rise mt-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-2xs font-semibold text-brand-fg">
            <GIcon name="verified" size={13} />
            Built for stock contributors
          </span>

          <h1 className="display mt-4 text-[2rem] leading-[1.08] font-bold tracking-[-0.028em] text-ink sm:text-[2.5rem]">
            Your whole stock workflow,
            <span className="block text-brand-fg">in one pocket studio.</span>
          </h1>

          <p className="mt-3 max-w-[34rem] text-[0.9375rem] leading-relaxed text-ink-muted">
            Photograph, prepare, tag, upscale and export. Everything a microstock portfolio needs,
            on the phone you already carry.
          </p>
        </div>

        <ul className="launch-rise mt-7 grid gap-2.5">
          {highlights.map((item) => (
            <li key={item.title} className="flex items-center gap-3 rounded-[var(--r-card)] border border-line bg-surface/90 p-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-brand-soft text-brand-fg">
                <GIcon name={item.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{item.title}</span>
                <span className="block text-[0.75rem] leading-snug text-ink-muted">{item.copy}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-7 space-y-2.5">
          <button type="button" onClick={onStart} className="launch-primary">
            Get started
            <GIcon name="arrow_forward" size={18} />
          </button>
          <button type="button" onClick={onSignIn} className="launch-secondary">
            I already have an account
          </button>
        </div>
      </div>
    </div>
  );
}
