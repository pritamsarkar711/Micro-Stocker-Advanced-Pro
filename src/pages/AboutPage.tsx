
import { PageHeader } from '@/components/layout/PageHeader';
import { Logo } from '@/components/layout/Logo';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { useApp } from '@/state/AppState';
import { desktop } from '@/lib/desktop';
import { APP_NAME } from '@/lib/version';

const HIGHLIGHTS: { icon: GoogleIconName; label: string; text: string }[] = [
  { icon: 'memory', label: 'AI metadata', text: 'Runs on device with a local model, or with your own API key.' },
  { icon: 'image', label: 'Upscale and convert', text: 'Local GPU upscalers, background removal, multi format export.' },
  { icon: 'fact_check', label: 'Pre-flight checks', text: 'Quality, editability and duplicate checks before you upload.' },
  { icon: 'polyline', label: 'Vector Studio', text: 'Draw, open and export editable SVG and EPS artwork.' },
  { icon: 'sell', label: 'Agency ready', text: 'Lossless IPTC and XMP writes plus CSV presets for every agency.' },
];

export function AboutPage() {
  const { runtime } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="About" />

      <Card padding="lg" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={44} showWordmark />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">v{runtime.version}</Badge>
            <Badge tone="ok">Offline capable</Badge>
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          {APP_NAME} is a complete microstock contributor studio: AI metadata, lossless IPTC and XMP
          embedding, agency CSV exports, image upscaling, video resize, background removal and format
          conversion.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.label} className="rounded-[var(--r-control)] border border-line p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <GIcon name={item.icon} size={18} className="text-brand" />
                {item.label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--r-control)] border border-line p-3">
            <div className="text-2xs uppercase tracking-wide text-ink-faint">Runtime</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              {runtime.isDesktop ? `Desktop (${runtime.platform})` : 'Web workspace'}
            </div>
          </div>
          <div className="rounded-[var(--r-control)] border border-line p-3">
            <div className="text-2xs uppercase tracking-wide text-ink-faint">Engine</div>
            <div className="mt-1 text-sm font-semibold text-ink">Chromium {runtime.chrome}</div>
          </div>
          <div className="rounded-[var(--r-control)] border border-line p-3">
            <div className="text-2xs uppercase tracking-wide text-ink-faint">Creator</div>
            <div className="mt-1 text-sm font-semibold text-ink">@joegoldberg2025</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <Button
            size="sm"
            variant="primary"
            icon={<BrandLogo brand="telegram" size={17} />}
            onClick={() => void desktop.shell.openExternal('https://t.me/joegoldberg2025')}
          >
            Telegram @joegoldberg2025
          </Button>
          <ButtonLink to="/report" size="sm" variant="secondary" icon={<GIcon name="rate_review" size={17} />}>
            Report issue
          </ButtonLink>
          <ButtonLink to="/settings" size="sm" variant="ghost" icon={<GIcon name="settings" size={17} />}>
            Settings
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
