import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CircleCheck,
  Cloud,
  CloudOff,
  FileDown,
  FolderPlus,
  HardDrive,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Wallet,
  Zap,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, SectionTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Misc';
import { Logo } from '@/components/layout/Logo';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useReleases } from '@/state/releases';
import { useViewport } from '@/hooks/useViewport';
import { isDesktop } from '@/lib/desktop';
import { kv } from '@/lib/kv';
import { relativeTime } from '@/lib/format';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import { validateEverywhere } from '@/lib/stock/validate';
import { countByStatus, loadSubmissions, STATUS_ORDER, STATUS_TONE, type SubmissionMap } from '@/lib/stock/submissions';
import { monthlySeries, type Sale } from '@/lib/stock/sales';
import type { PlatformId } from '@/lib/stock/types';

/** Dashboard stats stay instant on huge libraries. */
const SAMPLE_CAP = 600;

interface Check {
  id: string;
  label: string;
  detail: string;
  state: 'pass' | 'warn' | 'fail';
}

export function OverviewPage() {
  const { connection, recheckConnection, settings, zoom, runtime, cloud } = useApp();
  const library = useLibrary();
  const { releases } = useReleases();
  const viewport = useViewport();

  const [storageOk, setStorageOk] = useState<boolean | null>(null);
  const [lastWrite, setLastWrite] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionMap>({});
  const [sales, setSales] = useState<Sale[]>([]);

  const runSelfTest = useCallback(async () => {
    const stamp = new Date().toISOString();
    const wrote = await kv.set('msap:selftest', { stamp });
    const read = await kv.get<{ stamp?: string }>('msap:selftest', {});
    setStorageOk(Boolean(wrote) && read.stamp === stamp);
    setLastWrite(stamp);
  }, []);

  useEffect(() => {
    void runSelfTest();
    void loadSubmissions().then(setSubmissions);
    void kv.get<Sale[]>('msap:sales', []).then(setSales);
  }, [runSelfTest]);

  const onRefresh = async () => {
    setChecking(true);
    const [stored, sold] = await Promise.all([loadSubmissions(), kv.get<Sale[]>('msap:sales', [])]);
    setSubmissions(stored);
    setSales(sold);
    await Promise.all([recheckConnection(), runSelfTest()]);
    setChecking(false);
  };

  /* ---------------- derived stats ---------------- */
  const sample = useMemo(
    () => (library.items.length > SAMPLE_CAP ? library.items.slice(0, SAMPLE_CAP) : library.items),
    [library.items],
  );

  const stats = useMemo(() => {
    const complete = sample.filter(
      (item) =>
        item.metadata.title.trim().length > 0 &&
        item.metadata.description.trim().length > 0 &&
        item.metadata.keywords.length >= 5,
    );
    const embedded = sample.filter((item) => Boolean(item.embeddedAt)).length;

    const perPlatform = PLATFORM_LIST.map((platform) => {
      let ready = 0;
      let blocked = 0;
      for (const item of sample) {
        const issues = validateEverywhere(item, sample)[platform.id as PlatformId] ?? [];
        if (issues.some((issue) => issue.level === 'error')) blocked += 1;
        else if (item.metadata.title.trim()) ready += 1;
      }
      return { platform, ready, blocked };
    });

    const blocking = perPlatform.reduce((sum, row) => sum + row.blocked, 0);
    return { complete: complete.length, embedded, perPlatform, blocking };
  }, [sample]);

  const funnel = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const status of STATUS_ORDER) totals[status] = 0;
    for (const platform of PLATFORM_LIST) {
      const counts = countByStatus(submissions, platform.id);
      for (const status of STATUS_ORDER) totals[status] += counts[status];
    }
    return { totals, tracked: STATUS_ORDER.reduce((sum, status) => sum + totals[status], 0) };
  }, [submissions]);

  const trend = useMemo(() => monthlySeries(sales).slice(-12), [sales]);
  const revenue = useMemo(() => sales.reduce((sum, sale) => sum + (sale.earnings || 0), 0), [sales]);
  const linkedReleases = useMemo(
    () => releases.filter((release) => library.items.some((item) => (item.releaseIds ?? []).includes(release.id))).length,
    [releases, library.items],
  );

  const checks: Check[] = [
    {
      id: 'runtime',
      label: isDesktop ? `Electron ${runtime.electron ?? ''}` : 'Browser preview',
      detail: isDesktop ? `${runtime.platform} · desktop bridge active` : 'Renderer only — file writes download instead of overwrite',
      state: isDesktop ? 'pass' : 'warn',
    },
    {
      id: 'storage',
      label: 'Local storage',
      detail:
        storageOk === null
          ? 'Testing…'
          : storageOk
            ? `${isDesktop ? 'userData folder' : 'localStorage'}${lastWrite ? ` · ${relativeTime(lastWrite)}` : ''}`
            : 'Write/read round-trip failed',
      state: storageOk === null ? 'warn' : storageOk ? 'pass' : 'fail',
    },
    {
      id: 'cloud',
      label: 'Cloud',
      detail: cloud.url ? connection.message : 'Not configured — running offline',
      state: connection.state === 'online' ? 'pass' : connection.state === 'error' ? 'fail' : 'warn',
    },
    {
      id: 'layout',
      label: 'Layout',
      detail: `${viewport.width}×${viewport.height} · ${viewport.breakpoint.toUpperCase()} · ${settings.theme} · ${Math.round(zoom * 100)}%`,
      state: 'pass',
    },
  ];

  const hasLibrary = library.items.length > 0;

  return (
    <div className="animate-in-fast">
      {/* ---------------- hero ---------------- */}
      <section className="relative mb-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-16 size-72 rounded-full opacity-45 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 68%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 68%)' }}
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Logo size={44} className="hidden sm:inline-flex" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl lg:text-[1.75rem]">
                Studio overview
              </h1>
              <p className="mt-1 text-sm text-fg-muted">
                {hasLibrary
                  ? `${library.items.length} file${library.items.length === 1 ? '' : 's'} · ${stats.complete} fully metadata-ready · ${funnel.totals.accepted} accepted`
                  : 'Import artwork, generate metadata, export platform-perfect CSV.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/library">
              <Button size="sm" icon={<FolderPlus className="size-4" />}>
                Import
              </Button>
            </Link>
            <Link to="/export">
              <Button size="sm" variant="outline" icon={<FileDown className="size-4" />}>
                Export CSV
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              loading={checking}
              icon={<RefreshCw className="size-4" />}
              aria-label="Re-check system status"
            >
              <span className="hidden sm:inline">Re-check</span>
            </Button>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
          <span className="text-[0.6875rem] font-medium tracking-wide text-fg-subtle uppercase">
            10 marketplaces
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {PLATFORM_LIST.map((platform) => (
              <Link
                key={platform.id}
                to="/platforms"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-2.5 pl-1 text-xs font-medium text-fg-muted transition hover:border-line-strong hover:text-fg"
                title={platform.name}
              >
                <PlatformLogo id={platform.id} size={18} />
                <span className="hidden sm:inline">{platform.name}</span>
              </Link>
            ))}
          </span>
        </div>
      </section>

      {/* ---------------- KPIs ---------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Library"
          tone="brand"
          icon={<Boxes className="size-5" />}
          value={library.items.length}
          hint={`${stats.embedded} with embedded IPTC/XMP`}
          className="col-span-1"
        />
        <StatCard
          label="Metadata ready"
          tone={stats.complete === library.items.length && hasLibrary ? 'ok' : 'default'}
          icon={<CircleCheck className="size-5" />}
          value={stats.complete}
          hint={hasLibrary ? `${Math.round((stats.complete / Math.max(1, library.items.length)) * 100)}% of library` : 'Import files to begin'}
        />
        <StatCard
          label="Blocking issues"
          tone={stats.blocking > 0 ? 'danger' : 'ok'}
          icon={<ShieldAlert className="size-5" />}
          value={stats.blocking}
          hint="Per-platform validator errors"
        />
        <StatCard
          label="Earnings"
          tone={revenue > 0 ? 'ok' : 'default'}
          icon={<Wallet className="size-5" />}
          value={revenue > 0 ? `$${revenue.toFixed(0)}` : '—'}
          hint={sales.length > 0 ? `${sales.length} sales imported` : 'Import a portal sales CSV'}
        />
      </div>

      {/* ---------------- platform readiness + funnel ---------------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Platform readiness"
          description={hasLibrary ? `Sampled ${sample.length} file${sample.length === 1 ? '' : 's'}` : undefined}
          action={
            <Link to="/export">
              <Button size="xs" variant="ghost" iconRight={<ArrowRight className="size-3.5" />}>
                Export
              </Button>
            </Link>
          }
          flush
        >
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            {stats.perPlatform.map(({ platform, ready, blocked }) => {
              const pct = sample.length ? Math.round((ready / sample.length) * 100) : 0;
              return (
                <li key={platform.id} className="flex items-center gap-3 py-1.5">
                  <PlatformLogo id={platform.id} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">{platform.name}</span>
                      <span className="shrink-0 text-[0.6875rem] text-fg-subtle tabular-nums">
                        {blocked > 0 ? `${blocked} blocked` : `${pct}%`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${pct}%`,
                          background: blocked > 0 ? 'var(--warn)' : platform.color,
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Submission funnel"
          action={
            <Link to="/plan">
              <Button size="xs" variant="ghost" iconRight={<ArrowRight className="size-3.5" />}>
                Planner
              </Button>
            </Link>
          }
        >
          {funnel.tracked === 0 ? (
            <EmptyState
              className="py-8"
              icon={<Zap className="size-6" />}
              title="Nothing queued yet"
              description="Mark files as queued from the Export centre to track them here."
              action={
                <Link to="/export">
                  <Button size="sm" variant="outline">
                    Open Export
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
                {STATUS_ORDER.filter((status) => funnel.totals[status] > 0).map((status) => (
                  <span
                    key={status}
                    className="h-full"
                    style={{
                      width: `${(funnel.totals[status] / funnel.tracked) * 100}%`,
                      background:
                        status === 'accepted'
                          ? 'var(--ok)'
                          : status === 'rejected'
                            ? 'var(--danger)'
                            : status === 'submitted'
                              ? 'var(--brand)'
                              : status === 'queued'
                                ? 'var(--warn)'
                                : 'var(--fg-subtle)',
                    }}
                    title={`${status}: ${funnel.totals[status]}`}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {STATUS_ORDER.map((status) => (
                  <li key={status} className="flex items-center gap-2 text-sm">
                    <Badge tone={STATUS_TONE[status]} className="w-24 justify-center capitalize">
                      {status}
                    </Badge>
                    <span className="ml-auto font-semibold text-fg tabular-nums">{funnel.totals[status]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* ---------------- earnings + releases ---------------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Earnings trend"
          description={sales.length > 0 ? 'Unified ledger from every imported portal CSV' : undefined}
          action={
            <Link to="/earnings">
              <Button size="xs" variant="ghost" iconRight={<ArrowRight className="size-3.5" />}>
                Analytics
              </Button>
            </Link>
          }
        >
          {trend.length === 0 ? (
            <EmptyState
              className="py-8"
              icon={<Wallet className="size-6" />}
              title="No sales data yet"
              description="Import a sales CSV from any portal — columns are detected automatically."
              action={
                <Link to="/earnings">
                  <Button size="sm" variant="outline">
                    Import CSV
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="h-48 w-full sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="overviewEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(value: number) => `$${Math.round(value)}`}
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
                    name="Earnings"
                    dataKey="earnings"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    fill="url(#overviewEarnings)"
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="System health" action={<Badge tone={checks.every((c) => c.state !== 'fail') ? 'ok' : 'danger'} dot>{checks.filter((c) => c.state === 'pass').length}/4</Badge>} flush>
          <ul className="divide-y divide-line">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2.5 px-4 py-2.5 sm:px-5">
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
                    <CircleCheck className="size-3.5" />
                  ) : check.state === 'warn' ? (
                    <TriangleAlert className="size-3" />
                  ) : (
                    <ShieldAlert className="size-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{check.label}</p>
                  <p className="mt-0.5 break-words text-xs text-fg-muted">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
            <Badge tone="neutral" icon={<HardDrive className="size-3" />}>
              {isDesktop ? 'Disk + cache' : 'Browser cache'}
            </Badge>
            <Badge tone={cloud.url ? 'brand' : 'neutral'} icon={cloud.url ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}>
              {cloud.url ? 'Supabase' : 'Offline'}
            </Badge>
            <Badge tone="neutral" icon={<Monitor className="size-3" />}>
              {settings.density} density
            </Badge>
            {linkedReleases > 0 && (
              <Badge tone="ok" icon={<CircleCheck className="size-3" />}>
                {linkedReleases} release-linked
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* ---------------- quick start (empty library only) ---------------- */}
      {!hasLibrary && (
        <div className="mt-4">
          <SectionTitle hint="Takes about two minutes">Start here</SectionTitle>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { n: 1, to: '/library', icon: FolderPlus, t: 'Import artwork', d: 'EPS, AI, SVG, JPG, PNG, WebP — existing IPTC/XMP is read automatically.' },
              { n: 2, to: '/library', icon: Sparkles, t: 'Generate metadata', d: 'Titles, descriptions and keywords from your own keyword bank.' },
              { n: 3, to: '/export', icon: FileDown, t: 'Export & submit', d: 'Exact CSV per platform, safe filenames, embedded metadata.' },
            ].map((step) => (
              <Link key={step.n} to={step.to} className="group">
                <Card className="h-full transition group-hover:border-brand/50">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
                      <step.icon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg">
                        {step.n}. {step.t}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{step.d}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
