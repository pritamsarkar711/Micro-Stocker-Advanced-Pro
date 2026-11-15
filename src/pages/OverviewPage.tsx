import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Boxes,
  Check,
  Cloud,
  CloudOff,
  Database,
  HardDrive,
  Monitor,
  RefreshCw,
  Ruler,
  Sparkles,
  TriangleAlert,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/state/AppState';
import { useViewport } from '@/hooks/useViewport';
import { isDesktop } from '@/lib/desktop';
import { kv } from '@/lib/kv';
import { relativeTime } from '@/lib/format';

const SAMPLE_TREND = [
  { label: 'W1', activity: 42 },
  { label: 'W2', activity: 58 },
  { label: 'W3', activity: 51 },
  { label: 'W4', activity: 74 },
  { label: 'W5', activity: 69 },
  { label: 'W6', activity: 88 },
  { label: 'W7', activity: 96 },
  { label: 'W8', activity: 84 },
  { label: 'W9', activity: 110 },
  { label: 'W10', activity: 124 },
  { label: 'W11', activity: 118 },
  { label: 'W12', activity: 141 },
];

interface Check {
  id: string;
  label: string;
  detail: string;
  state: 'pass' | 'warn' | 'fail';
}

export function OverviewPage() {
  const { connection, recheckConnection, settings, zoom, runtime, cloud } = useApp();
  const viewport = useViewport();
  const [storageOk, setStorageOk] = useState<boolean | null>(null);
  const [lastWrite, setLastWrite] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const runSelfTest = useCallback(async () => {
    const stamp = new Date().toISOString();
    const wrote = await kv.set('msap:selftest', { stamp });
    const read = await kv.get<{ stamp?: string }>('msap:selftest', {});
    setStorageOk(Boolean(wrote) && read.stamp === stamp);
    setLastWrite(stamp);
  }, []);

  useEffect(() => {
    void runSelfTest();
  }, [runSelfTest]);

  const checks: Check[] = [
    {
      id: 'runtime',
      label: 'Runtime',
      detail: isDesktop
        ? `Electron ${runtime.electron ?? ''} on ${runtime.platform}`
        : 'Browser preview (renderer only) — desktop bridge emulated',
      state: isDesktop ? 'pass' : 'warn',
    },
    {
      id: 'storage',
      label: 'Local storage',
      detail:
        storageOk === null
          ? 'Testing write/read…'
          : storageOk
            ? `Writable · ${isDesktop ? 'userData/app-data' : 'localStorage'}${lastWrite ? ` · ${relativeTime(lastWrite)}` : ''}`
            : 'Write/read round-trip failed',
      state: storageOk === null ? 'warn' : storageOk ? 'pass' : 'fail',
    },
    {
      id: 'cloud',
      label: 'Cloud connection',
      detail: cloud.url ? `${connection.message}` : 'Not configured — running offline by design',
      state: connection.state === 'online' ? 'pass' : connection.state === 'error' ? 'fail' : 'warn',
    },
    {
      id: 'responsive',
      label: 'Responsive layout',
      detail: `${viewport.width}×${viewport.height} CSS px · breakpoint ${viewport.breakpoint.toUpperCase()} · DPR ${viewport.dpr.toFixed(2)}`,
      state: 'pass',
    },
    {
      id: 'theme',
      label: 'Theme & density',
      detail: `${settings.theme} theme · ${settings.density} density · UI scale ${Math.round(zoom * 100)}%`,
      state: 'pass',
    },
    {
      id: 'spec',
      label: 'Feature spec',
      detail: 'Awaiting your description of what Micro Stocker Advanced Pro must do',
      state: 'fail',
    },
  ];

  const onRefresh = async () => {
    setChecking(true);
    await Promise.all([recheckConnection(), runSelfTest()]);
    setChecking(false);
  };

  return (
    <>
      <PageHeader
        title="Overview"
        description="Foundation build of Micro Stocker Advanced Pro: responsive shell, offline storage and the Supabase cloud layer. Feature modules are added as soon as the spec is confirmed."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              loading={checking}
              icon={<RefreshCw className="size-4" />}
            >
              Re-check
            </Button>
            <Link to="/cloud">
              <Button size="sm" icon={<Cloud className="size-4" />}>
                Connect cloud
              </Button>
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-brand-fg" />
          <p className="text-sm leading-relaxed text-fg">
            <strong className="font-semibold">Status: scaffold complete.</strong> Everything below is
            real and working — but the business screens (the actual “Micro Stocker” features) are not
            built yet, because the app description never arrived. Tell me what it should do and these
            placeholder cards become your dashboard.
          </p>
        </div>
      </PageHeader>

      <div className="grid-auto-fit gap-3 sm:gap-4">
        <StatCard
          label="Connection"
          tone={connection.state === 'online' ? 'ok' : connection.state === 'error' ? 'danger' : 'default'}
          icon={connection.state === 'online' ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
          value={
            connection.state === 'online'
              ? 'Online'
              : connection.state === 'connecting'
                ? 'Connecting'
                : connection.state === 'error'
                  ? 'Error'
                  : 'Offline'
          }
          hint={connection.message}
        />
        <StatCard
          label="Data storage"
          tone="brand"
          icon={<Database className="size-5" />}
          value={cloud.url && connection.state === 'online' ? 'Cloud + cache' : 'Local device'}
          hint={
            isDesktop
              ? runtime.userDataPath ?? 'Electron userData folder'
              : 'localStorage (browser preview)'
          }
        />
        <StatCard
          label="Viewport"
          icon={<Monitor className="size-5" />}
          value={`${viewport.width}px`}
          hint={`Breakpoint ${viewport.breakpoint.toUpperCase()} · ${viewport.isTouch ? 'touch input' : 'pointer input'} · DPR ${viewport.dpr.toFixed(1)}`}
        />
        <StatCard
          label="UI scale"
          icon={<ZoomIn className="size-5" />}
          value={`${Math.round(zoom * 100)}%`}
          hint={`${settings.theme} theme · ${settings.density} density`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="System health"
          description="Live checks performed in this running instance"
          action={<Badge tone={checks.every((c) => c.state !== 'fail') ? 'ok' : 'warn'} dot>{checks.filter((c) => c.state === 'pass').length}/{checks.length} passed</Badge>}
          flush
        >
          <ul className="divide-y divide-line">
            {checks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  className={
                    check.state === 'pass'
                      ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok'
                      : check.state === 'warn'
                        ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn'
                        : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger'
                  }
                >
                  {check.state === 'pass' ? (
                    <Check className="size-3" />
                  ) : check.state === 'warn' ? (
                    <TriangleAlert className="size-3" />
                  ) : (
                    <X className="size-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{check.label}</p>
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-fg-muted">
                    {check.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Activity trend"
          description="Sample data — proves the charting layer is wired up"
          action={<Badge tone="neutral">demo</Badge>}
        >
          <div className="h-52 w-full sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SAMPLE_TREND} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={12}
                />
                <YAxis
                  tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--fg)',
                  }}
                  labelStyle={{ color: 'var(--fg-muted)' }}
                />
                <Area
                  type="monotone"
                  dataKey="activity"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#activityFill)"
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="What is already built" description="Foundation you can click through right now">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              ['Responsive shell', Ruler],
              ['Sidebar rail + drawer + tab bar', Boxes],
              ['Light/dark + density + UI scale', Sparkles],
              ['Local key/value store with self-test', HardDrive],
              ['Supabase cloud layer + schema SQL', Cloud],
              ['Charts, tables, dialogs, toasts', Activity],
              ['Electron main/preload with secure IPC', Monitor],
              ['Windows/macOS/Linux packaging + CI', RefreshCw],
            ].map(([label, Icon]) => {
              const Item = Icon as typeof Activity;
              return (
                <li
                  key={String(label)}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg"
                >
                  <Item className="size-4 shrink-0 text-brand" />
                  <span className="truncate">{String(label)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Waiting on you"
          description="These decisions unlock the real feature build"
          action={<Badge tone="warn" dot>blocked</Badge>}
        >
          <ol className="flex flex-col gap-3">
            {[
              {
                n: 1,
                t: 'Describe the app',
                d: 'What does Micro Stocker Advanced Pro do? Who uses it, and what are the 3–5 main screens?',
              },
              {
                n: 2,
                t: 'Supabase project (or switch to offline)',
                d: 'Paste your project URL + anon key on the Cloud page — or tell me to run offline-only with SQLite.',
              },
              {
                n: 3,
                t: 'Confirm the first module',
                d: 'I will build one complete module end to end (UI + data + cloud + tests) as the pattern for the rest.',
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-fg">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{step.t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/cloud">
              <Button size="sm" variant="outline" icon={<Cloud className="size-4" />}>
                Cloud setup
              </Button>
            </Link>
            <Link to="/responsive">
              <Button size="sm" variant="ghost" icon={<Ruler className="size-4" />}>
                Responsive lab
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <SectionTitle hint="Resize the window or open the Responsive Lab to verify">
          Layout behaviour
        </SectionTitle>
        <Card className="mt-2" flush>
          <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {[
              ['< 768px', 'Drawer nav + bottom tabs, cards instead of tables'],
              ['768–1023px', 'Drawer nav, tables appear, 2-column grids'],
              ['1024–1279px', 'Collapsed icon rail, 3-column grids'],
              ['≥ 1280px', 'Full sidebar, dense multi-column workspace'],
            ].map(([range, behaviour]) => (
              <div key={range} className="border-b border-line p-4 last:border-0 sm:border-b-0">
                <p className="font-mono text-xs text-brand-fg">{range}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{behaviour}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
