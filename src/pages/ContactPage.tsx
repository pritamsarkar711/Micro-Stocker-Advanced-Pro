
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { desktop } from '@/lib/desktop';
import { appName } from '@/lib/version';

const TELEGRAM_ID = '@joegoldberg2025';
const TELEGRAM_URL = 'https://t.me/joegoldberg2025';

export function ContactPage() {
  const toast = useToast();

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(TELEGRAM_ID);
      toast.success('Telegram ID copied', TELEGRAM_ID);
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Contact" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg" className="flex flex-col justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[#26A5E4]/10 p-1">
              <BrandLogo brand="telegram" size={44} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Telegram Direct
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{TELEGRAM_ID}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Reach the creator directly on Telegram for questions, feature discussions or
                support with {appName()}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <Button
              variant="primary"
              icon={<BrandLogo brand="telegram" size={17} />}
              onClick={() => void desktop.shell.openExternal(TELEGRAM_URL)}
            >
              Message {TELEGRAM_ID}
            </Button>
            <Button
              variant="secondary"
              icon={<GIcon name="content_copy" size={16} />}
              onClick={() => void copyHandle()}
            >
              Copy ID
            </Button>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-[var(--r-card)] bg-accent-soft text-accent">
              <GIcon name="bug_report" size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Problem Reports
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">
                Submit an issue inside the app
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Encountered a bug, model issue or marketplace rule update? Send a structured report
                straight from your workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <ButtonLink to="/report" variant="secondary" icon={<GIcon name="arrow_forward" size={16} />}>
              Open Report Form
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
