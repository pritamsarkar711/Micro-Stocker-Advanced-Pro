import { Code2, ExternalLink, Layers, Terminal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useApp } from '@/state/AppState';
import { desktop, isDesktop } from '@/lib/desktop';

const REPO_URL = 'https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro';

const STACK: [string, string][] = [
  ['Electron 45', 'Desktop shell: windows, menus, IPC, packaging'],
  ['React 19 + TypeScript 5.9', 'Renderer UI'],
  ['Vite 7', 'Dev server and production build'],
  ['Tailwind CSS 4', 'Utility styling, dark mode, container-friendly grids'],
  ['React Router 7 (hash)', 'Routing that also works from file://'],
  ['Recharts', 'Dashboard charts'],
  ['Supabase JS 2', 'Postgres + auth + realtime cloud layer'],
  ['electron-builder 26', 'NSIS / dmg / AppImage installers'],
  ['GitHub Actions', 'Builds real installers on tag push'],
];

export function AboutPage() {
  const { runtime, connection, settings, zoom } = useApp();

  const rows = [
    { label: 'App version', value: runtime.version },
    { label: 'Mode', value: runtime.isDev ? 'development (hot reload)' : 'production build' },
    { label: 'Runtime', value: isDesktop ? `Electron ${runtime.electron ?? '—'}` : 'Browser preview' },
    { label: 'Chromium', value: runtime.chrome },
    { label: 'Node', value: runtime.node ?? 'n/a (browser)' },
    { label: 'Platform', value: `${runtime.platform}${runtime.arch ? ` / ${runtime.arch}` : ''}` },
    { label: 'Cloud', value: connection.state },
    { label: 'Theme', value: `${settings.theme} / ${settings.density} / ${Math.round(zoom * 100)}%` },
    { label: 'User data', value: runtime.userDataPath ?? 'localStorage (browser)' },
  ];

  const columns: Column<{ label: string; value: string }>[] = [
    { key: 'label', header: 'Property', primary: true, sortable: true },
    {
      key: 'value',
      header: 'Value',
      render: (row) => <span className="break-all font-mono text-xs text-fg-muted">{row.value}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="About"
        description="Runtime details of this exact instance."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<Code2 className="size-4" />}
            onClick={() => desktop.shell.openExternal(REPO_URL)}
          >
            Repository
          </Button>
        }
      >
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <Logo size={56} />
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-fg">Micro Stocker Advanced Pro</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Responsive cross-platform desktop application scaffold · v{runtime.version}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge tone={isDesktop ? 'brand' : 'neutral'} dot>
                {isDesktop ? 'Desktop runtime' : 'Browser preview'}
              </Badge>
              <Badge tone={connection.state === 'online' ? 'ok' : connection.state === 'error' ? 'danger' : 'neutral'} dot>
                {connection.state}
              </Badge>
              <Badge tone="outline">MIT licence</Badge>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Runtime" description="Read live from the Electron main process or the browser" flush>
          <DataTable rows={rows} columns={columns} rowKey={(row) => row.label} dense />
        </Card>

        <Card title="Technology stack" description="Every layer chosen for a reason">
          <ul className="flex flex-col gap-2">
            {STACK.map(([name, role]) => (
              <li key={name} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
                <Layers className="mt-0.5 size-4 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{role}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4" title="Developer commands" description="Run these in the project folder on your own PC">
        <div className="flex flex-col gap-2">
          {[
            ['npm install', 'Install dependencies (downloads Electron)'],
            ['npm run dev', 'Vite dev server + Electron window with hot reload'],
            ['npm run dev:web', 'Renderer only, in a browser (phone/tablet testing over LAN)'],
            ['npm run verify', 'Type check + production build'],
            ['npm run dist:win', 'Build the Windows installer into release/'],
            ['git tag v1.0.0 && git push --tags', 'GitHub Actions builds installers and publishes a Release'],
          ].map(([command, note]) => (
            <div
              key={command}
              className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <code className="flex items-center gap-2 font-mono text-xs text-brand-fg sm:w-72 sm:shrink-0">
                <Terminal className="size-3.5 shrink-0" />
                {command}
              </code>
              <span className="text-xs text-fg-muted">{note}</span>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          icon={<ExternalLink className="size-4" />}
          onClick={() => desktop.shell.openExternal(REPO_URL)}
        >
          Open the repository
        </Button>
      </Card>
    </>
  );
}
