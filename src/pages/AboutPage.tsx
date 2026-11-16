import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Logo } from '@/components/layout/Logo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useApp } from '@/state/AppState';
import { desktop } from '@/lib/desktop';
import { APP_NAME } from '@/lib/version';

export function AboutPage() {
  const { runtime } = useApp();

  return (
    <div className="space-y-5">
      <PageHeader title="About" />

      <Card padding="lg" className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <Logo size={40} showWordmark />
          <Badge tone="brand">v{runtime.version}</Badge>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          {APP_NAME} is an all in one microstock contributor studio for AI metadata generation,
          lossless IPTC and XMP embedding, agency CSV exports, open source image and video
          upscaling, background removal and multi format image conversion.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
          <div className="rounded-[var(--r-control)] border border-line p-2.5">
            <div className="text-2xs text-ink-faint">Runtime</div>
            <div className="mt-0.5 font-semibold text-ink">
              {runtime.isDesktop ? `Desktop (${runtime.platform})` : 'Web Workspace'}
            </div>
          </div>
          <div className="rounded-[var(--r-control)] border border-line p-2.5">
            <div className="text-2xs text-ink-faint">Engine</div>
            <div className="mt-0.5 font-semibold text-ink">Chromium {runtime.chrome}</div>
          </div>
          <div className="rounded-[var(--r-control)] border border-line p-2.5">
            <div className="text-2xs text-ink-faint">Creator</div>
            <div className="mt-0.5 font-semibold text-ink">@joegoldberg2025</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button
            size="sm"
            variant="primary"
            icon={<BrandLogo brand="telegram" size={16} />}
            onClick={() => void desktop.shell.openExternal('https://t.me/joegoldberg2025')}
          >
            Telegram @joegoldberg2025
          </Button>
          <Link to="/report">
            <Button size="sm" variant="secondary" icon={<GIcon name="bug_report" size={15} />}>
              Report Issue
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            icon={<BrandLogo brand="github" size={15} />}
            onClick={() =>
              void desktop.shell.openExternal(
                'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro',
              )
            }
          >
            GitHub
          </Button>
        </div>
      </Card>
    </div>
  );
}
