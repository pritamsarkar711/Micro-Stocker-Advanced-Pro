import { Code2, ExternalLink, Layers } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';
import { useApp } from '@/state/AppState';
import { desktop, isDesktop } from '@/lib/desktop';

const REPO_URL = 'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro';
const LICENCE_URL = `${REPO_URL}/blob/main/LICENSE`;

const STACK: [string, string][] = [
  ['Electron 45', 'Desktop runtime'],
  ['React 19', 'UI renderer'],
  ['TypeScript 5.9', 'Type safety'],
  ['Vite 7', 'Build'],
  ['Tailwind CSS 4', 'Styling'],
  ['Recharts', 'Charts'],
  ['Supabase 2', 'Cloud sync'],
];

export function AboutPage() {
  const { runtime, connection } = useApp();

  const rows: [string, string][] = [
    ['Version', runtime.version],
    ['Mode', isDesktop ? `Desktop · Electron ${runtime.electron ?? '—'}` : 'Browser preview'],
    ['Cache', runtime.chrome ?? '—'],
    ['Node', runtime.node ?? 'n/a'],
    ['Platform', `${runtime.platform}${runtime.arch ? ` / ${runtime.arch}` : ''}`],
    ['Cloud', connection.state],
    ['Data', runtime.userDataPath ?? 'local storage'],
  ];

  return (
    <>
      <PageHeader
        title="About"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<Code2 className="size-4" />}
            onClick={() => desktop.shell.openExternal(REPO_URL)}
          >
            GitHub
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div className="min-w-0 flex-1">
              <p className="display truncate text-[1rem] font-extrabold tracking-[-0.02em] text-fg">
                Micro Stocker Advanced Pro
              </p>
              <p className="nums truncate text-[0.75rem] text-fg-muted">
                v{runtime.version} · © 2026 pritamsarkar711
              </p>
            </div>
            <Badge tone={isDesktop ? 'brand' : 'neutral'} dot>
              {isDesktop ? 'Desktop' : 'Preview'}
            </Badge>
          </div>

          <dl className="mt-4 divide-y divide-line border-t border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="shrink-0 text-[0.75rem] text-fg-subtle">{label}</dt>
                <dd className="truncate font-mono text-[0.6875rem] text-fg-muted" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex flex-col gap-3">
          <Card title="Stack">
            <ul className="divide-y divide-line">
              {STACK.map(([name, role]) => (
                <li key={name} className="flex items-center gap-2 py-2">
                  <Layers className="size-3.5 shrink-0 text-brand" />
                  <span className="flex-1 truncate text-[0.8125rem] text-fg">{name}</span>
                  <span className="text-[0.6875rem] text-fg-subtle">{role}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Licence">
            <p className="text-[0.75rem] leading-relaxed text-fg-muted">
              Source-available. Free for personal and commercial work; no resale.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="xs"
                variant="outline"
                icon={<ExternalLink className="size-3" />}
                onClick={() => desktop.shell.openExternal(LICENCE_URL)}
              >
                Read licence
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon={<ExternalLink className="size-3" />}
                onClick={() => desktop.shell.openExternal(`${REPO_URL}/blob/main/THIRD-PARTY-NOTICES.md`)}
              >
                Notices
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
