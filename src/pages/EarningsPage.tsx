import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, LineChart, Trash2, Upload } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Select } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/Misc';
import { useToast } from '@/state/ToastState';
import { kv } from '@/lib/kv';
import { desktop } from '@/lib/desktop';
import { money } from '@/lib/format';
import { useApp } from '@/state/AppState';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { findPlatform, PLATFORM_LIST } from '@/lib/stock/platforms';
import { PLATFORM_BRAND } from '@/lib/stock/brand';
import type { PlatformId } from '@/lib/stock/types';
import {
  detectMapping, mapRows, monthlySeries, parseDelimited, platformTotals, topTitles,
  type ColumnMapping, type Sale,
} from '@/lib/stock/sales';

const SALES_KEY = 'msap:sales';

export function EarningsPage() {
  const toast = useToast();
  const { settings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [platform, setPlatform] = useState<PlatformId | 'other'>('shutterstock');
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; delimiter: string } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);

  useEffect(() => {
    if (loaded) return;
    kv.get<Sale[]>(SALES_KEY, []).then((stored) => {
      setSales(stored);
      setLoaded(true);
    });
  }, [loaded]);

  const persist = (next: Sale[]) => {
    setSales(next);
    void kv.set(SALES_KEY, next);
  };

  const onFileText = (text: string) => {
    const result = parseDelimited(text);
    if (result.headers.length < 2) {
      toast.error('Could not parse', 'No header row detected. Use a CSV export from the portal.');
      return;
    }
    setParsed(result);
    setMapping(detectMapping(result.headers));
  };

  const onPickFile = async (file: File) => onFileText(await file.text());

  const confirmImport = () => {
    if (!parsed || !mapping) return;
    const mapped = mapRows(parsed.rows, parsed.headers, mapping, platform);
    if (mapped.length === 0) {
      toast.error('Nothing mapped', 'Check the column assignment. Date or earnings column is missing.');
      return;
    }
    const existingIds = new Set(sales.map((s) => s.id));
    const fresh = mapped.filter((s) => !existingIds.has(s.id));
    persist([...fresh, ...sales]);
    setParsed(null);
    setMapping(null);
    toast.success(`Imported ${fresh.length} sales`, `${mapped.length - fresh.length} duplicate rows skipped.`);
  };

  const monthly = useMemo(() => monthlySeries(sales), [sales]);
  const byPlatform = useMemo(() => platformTotals(sales), [sales]);
  const top = useMemo(() => topTitles(sales), [sales]);
  const totalEarnings = sales.reduce((sum, s) => sum + s.earnings, 0);
  const totalDownloads = sales.reduce((sum, s) => sum + s.downloads, 0);

  const exportLedger = async () => {
    const header = 'Date,Platform,Title,License,Country,Downloads,Earnings';
    const lines = sales.map((s) => [s.date, s.platform, `"${s.title.replace(/"/g, '""')}"`, s.license, s.country, s.downloads, s.earnings.toFixed(2)].join(','));
    const csv = `${header}\n${lines.join('\n')}\n`;
    if (desktop.isDesktop) await desktop.fs.exportText({ defaultName: 'microstocker-ledger.csv', text: csv, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    else {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'microstocker-ledger.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    toast.success('Unified ledger exported');
  };

  const topColumns: Column<{ title: string; earnings: number; downloads: number }>[] = [
    { key: 'title', header: 'Title', primary: true, render: (row) => <span className="block truncate text-fg">{row.title}</span> },
    { key: 'downloads', header: 'Downloads', align: 'right', sortable: true, sortValue: (r) => r.downloads, render: (r) => <span className="tabular-nums">{r.downloads}</span> },
    { key: 'earnings', header: 'Earnings', align: 'right', sortable: true, sortValue: (r) => r.earnings, render: (r) => <span className="tabular-nums">{money(r.earnings, settings.currency)}</span> },
  ];

  /** Unknown platform ids fall back to the brand at decreasing opacity — one hue. */
  const BAR_FALLBACK = ['var(--brand)', 'color-mix(in oklab, var(--brand) 72%, var(--surface))', 'color-mix(in oklab, var(--brand) 46%, var(--surface))'];

  return (
    <>
      <PageHeader
        title="Earnings"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
            <Button size="sm" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Import CSV</Button>
            <Button size="sm" variant="outline" icon={<Download className="size-4" />} onClick={exportLedger} disabled={sales.length === 0}>Export ledger</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => { persist([]); toast.info('Sales data cleared'); }} disabled={sales.length === 0}>Clear</Button>
          </>
        }
      >
        <div className="grid-auto-fit gap-3">
          <div className="card p-4">
            <p className="text-[0.6875rem] text-fg-subtle">Earnings</p>
            <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{money(totalEarnings, settings.currency)}</p>
          </div>
          <div className="card p-4">
            <p className="text-[0.6875rem] text-fg-subtle">Downloads</p>
            <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{totalDownloads.toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-[0.6875rem] text-fg-subtle">Platforms</p>
            <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{byPlatform.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-[0.6875rem] text-fg-subtle">Avg / download</p>
            <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{money(totalDownloads ? totalEarnings / totalDownloads : 0, settings.currency)}</p>
          </div>
        </div>
      </PageHeader>

      {parsed && mapping && (
        <Card className="mb-2" title="Column mapping" description={`${parsed.rows.length} rows`}>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((key) => (
              <Field key={key} label={key}>
                <Select value={mapping[key]} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })} options={[{ value: '', label: 'Skip' }, ...parsed!.headers.map((h) => ({ value: h, label: h }))]} />
              </Field>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Field label="Platform of this file" className="w-full sm:w-52">
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId | 'other')} options={[...PLATFORM_LIST.map((p) => ({ value: p.id, label: p.name })), { value: 'other', label: 'Other / aggregator' }]} />
            </Field>
            <Button onClick={confirmImport} icon={<Upload className="size-4" />}>Import {parsed.rows.length} rows</Button>
            <Button variant="ghost" onClick={() => { setParsed(null); setMapping(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {sales.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="size-7" />}
            title="No sales imported yet"
            
            action={<Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Import first CSV</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Card title="Trend" action={<LineChart className="size-4 text-fg-subtle" />}>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, color: 'var(--fg)' }} />
                  <Area type="monotone" dataKey="earnings" stroke="var(--brand)" strokeWidth={2} fill="url(#earnFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="By platform">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPlatform} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="platform" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, color: 'var(--fg)' }} />
                  <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
                    {byPlatform.map((entry, index) => (
                      <Cell
                        key={entry.platform}
                        fill={
                          (() => {
                            const known = findPlatform(entry.platform);
                            return known ? PLATFORM_BRAND[known].color : BAR_FALLBACK[index % BAR_FALLBACK.length];
                          })()
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="xl:col-span-2" title="Best sellers" flush>
            <DataTable rows={top} columns={topColumns} rowKey={(row) => row.title} dense />
          </Card>

          <Card className="xl:col-span-2" title="Recent" flush>
            <DataTable
              rows={[...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50)}
              columns={[
                { key: 'date', header: 'Date', primary: true, sortable: true, render: (r) => <span className="tabular-nums">{r.date}</span> },
                { key: 'platform', header: 'Platform', hideBelow: 'sm', render: (r) => {
                    const known = findPlatform(r.platform);
                    return (
                      <span className="flex items-center gap-1.5">
                        {known && <PlatformLogo id={known} size={16} />}
                        <Badge tone="brand">{r.platform}</Badge>
                      </span>
                    );
                  } },
                { key: 'title', header: 'Title', hideBelow: 'md', render: (r) => <span className="block max-w-72 truncate">{r.title}</span> },
                { key: 'license', header: 'License', hideBelow: 'xl' },
                { key: 'downloads', header: 'Dl', align: 'right', hideBelow: 'lg', render: (r) => <span className="tabular-nums">{r.downloads}</span> },
                { key: 'earnings', header: 'Earnings', align: 'right', sortable: true, sortValue: (r) => r.earnings, render: (r) => <span className="tabular-nums">{money(r.earnings, settings.currency)}</span> },
              ]}
              rowKey={(row) => row.id}
              dense
            />
          </Card>
        </div>
      )}
    </>
  );
}
