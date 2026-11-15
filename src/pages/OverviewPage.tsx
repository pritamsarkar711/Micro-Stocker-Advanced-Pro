import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Cloud,
  CloudOff,
  FileDown,
  Images,
  ShieldAlert,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Kpi } from '@/components/ui/Kpi';
import { Badge } from '@/components/ui/Badge';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useReleases } from '@/state/releases';
import { kv } from '@/lib/kv';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import { validateEverywhere } from '@/lib/stock/validate';
import {
  countByStatus,
  loadSubmissions,
  STATUS_ORDER,
  STATUS_TONE,
  type SubmissionMap,
} from '@/lib/stock/submissions';
import { monthlySeries, type Sale } from '@/lib/stock/sales';
import type { PlatformId } from '@/lib/stock/types';

const SAMPLE_CAP = 600;

const STEPS = [
  { to: '/library', label: 'Import', icon: Images },
  { to: '/prepare', label: 'Clean', icon: BadgeCheck },
  { to: '/upscale', label: 'Upscale', icon: Zap },
  { to: '/export', label: 'Export', icon: FileDown },
  { to: '/plan', label: 'Track', icon: CalendarCheck },
];

export function OverviewPage() {
  const { connection } = useApp();
  const library = useLibrary();
  const { releases } = useReleases();

  const [submissions, setSubmissions] = useState<SubmissionMap>({});
  const [sales, setSales] = useState<Sale[]>([]);

  const reload = useCallback(async () => {
    const [queued, sold] = await Promise.all([
      loadSubmissions(),
      kv.get<Sale[]>('msap:sales', []),
    ]);
    setSubmissions(queued);
    setSales(sold);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sample = useMemo(
    () => (library.items.length > SAMPLE_CAP ? library.items.slice(0, SAMPLE_CAP) : library.items),
    [library.items],
  );

  const stats = useMemo(() => {
    const ready = sample.filter(
      (item) =>
        item.metadata.title.trim().length > 0 &&
        item.metadata.description.trim().length > 0 &&
        item.metadata.keywords.length >= 5,
    ).length;
    const embedded = sample.filter((item) => Boolean(item.embeddedAt)).length;

    const perPlatform = PLATFORM_LIST.map((platform) => {
      let ok = 0;
      let blocked = 0;
      for (const item of sample) {
        const issues = validateEverywhere(item, sample)[platform.id as PlatformId] ?? [];
        if (issues.some((issue) => issue.level === 'error')) blocked += 1;
        else if (item.metadata.title.trim()) ok += 1;
      }
      return { platform, ok, blocked };
    });

    return {
      ready,
      embedded,
      perPlatform,
      blocking: perPlatform.reduce((sum, row) => sum + row.blocked, 0),
    };
  }, [sample]);

  const funnel = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const status of STATUS_ORDER) totals[status] = 0;
    for (const platform of PLATFORM_LIST) {
      const counts = countByStatus(submissions, platform.id);
      for (const status of STATUS_ORDER) totals[status] += counts[status];
    }
    return totals;
  }, [submissions]);

  const trend = useMemo(() => monthlySeries(sales).slice(-12), [sales]);
  const revenue = useMemo(
    () => sales.reduce((sum, sale) => sum + (sale.earnings || 0), 0),
    [sales],
  );
  const linkedReleases = useMemo(
    () =>
      releases.filter((release) =>
        library.items.some((item) => (item.releaseIds ?? []).includes(release.id)),
      ).length,
    [releases, library.items],
  );

  const total = library.items.length;
  const topPlatforms = useMemo(
    () => [...stats.perPlatform].sort((a, b) => b.blocked - a.blocked).slice(0, 5),
    [stats.perPlatform],
  );

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <Badge tone={connection.state === 'online' ? 'ok' : 'neutral'} dot>
            {connection.state === 'online' ? 'Synced' : 'Local'}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Files" value={total} icon={Images} to="/library" tone="brand" />
        <Kpi
          label="Ready"
          value={stats.ready}
          unit={total ? `/ ${total}` : undefined}
          icon={BadgeCheck}
          tone={total && stats.ready === total ? 'ok' : 'default'}
          to="/export"
        />
        <Kpi
          label="Blocked"
          value={stats.blocking}
          icon={ShieldAlert}
          tone={stats.blocking ? 'danger' : 'ok'}
          to="/export"
        />
        <Kpi
          label="Revenue"
          value={`$${revenue.toFixed(0)}`}
          icon={Wallet}
          tone={revenue ? 'ok' : 'default'}
          to="/earnings"
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-3">
        {/* Readiness */}
        <Card
          className="xl:col-span-2"
          title="Platform readiness"
          action={<Link to="/platforms" className="text-[0.6875rem] font-medium text-brand">All</Link>}
          flush
        >
          {total === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <Images className="size-6 text-fg-subtle" strokeWidth={1.6} />
              <p className="text-[0.8125rem] text-fg-muted">No files yet</p>
              <Link
                to="/library"
                className="r-control border border-line-strong px-2.5 py-1 text-[0.75rem] font-medium text-fg hover:bg-surface-2"
              >
                Import files
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {topPlatforms.map(({ platform, ok, blocked }) => (
                <li key={platform.id} className="flex items-center gap-2.5 px-3.5 py-2">
                  <PlatformLogo id={platform.id} size={20} />
                  <span className="w-28 shrink-0 truncate text-[0.8125rem] font-medium text-fg">
                    {platform.name}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((ok / Math.max(1, total)) * 100)}%` }}
                    />
                  </span>
                  <span className="nums w-10 shrink-0 text-right text-[0.75rem] text-fg-muted">
                    {ok}
                  </span>
                  {blocked > 0 && (
                    <span className="nums w-8 shrink-0 text-right text-[0.75rem] text-danger">
                      {blocked}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Queue */}
        <Card title="Pipeline" action={<Link to="/plan" className="text-[0.6875rem] font-medium text-brand">Open</Link>} flush>
          <ul className="divide-y divide-line">
            {STATUS_ORDER.map((status) => (
              <li key={status} className="flex items-center justify-between px-3.5 py-2">
                <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                <span className="nums text-[0.8125rem] font-semibold text-fg">
                  {funnel[status] ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Revenue · 12 months" flush>
          <div className="h-48 px-2 py-2">
            {trend.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Wallet className="size-5 text-fg-subtle" strokeWidth={1.6} />
                <p className="text-[0.75rem] text-fg-muted">No sales imported</p>
                <Link to="/earnings" className="text-[0.75rem] font-medium text-brand">
                  Import CSV
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(value: number) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--fg)',
                    }}
                    labelStyle={{ color: 'var(--fg-subtle)' }}
                    formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, 'Earnings']}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="var(--brand)"
                    strokeWidth={1.75}
                    fill="var(--brand)"
                    fillOpacity={0.08}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Next steps" flush>
          <ul className="divide-y divide-line">
            {STEPS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-[0.8125rem] text-fg hover:bg-surface-2"
                >
                  <Icon className="size-4 text-fg-subtle" strokeWidth={1.8} />
                  <span className="flex-1 truncate">{label}</span>
                  <ArrowRight className="size-3.5 text-fg-subtle" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/cloud"
                className="flex items-center gap-2.5 px-3.5 py-2 text-[0.8125rem] text-fg hover:bg-surface-2"
              >
                {connection.state === 'online' ? (
                  <Cloud className="size-4 text-ok" strokeWidth={1.8} />
                ) : (
                  <CloudOff className="size-4 text-fg-subtle" strokeWidth={1.8} />
                )}
                <span className="flex-1 truncate">Cloud</span>
                <ArrowRight className="size-3.5 text-fg-subtle" />
              </Link>
            </li>
          </ul>
          <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-[0.6875rem] text-fg-subtle">
            <span>Releases linked</span>
            <span className="nums text-fg-muted">{linkedReleases}</span>
          </div>
        </Card>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card flex items-center gap-2 px-3 py-2 text-[0.75rem] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <Icon className="size-4 text-brand" strokeWidth={1.9} />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
