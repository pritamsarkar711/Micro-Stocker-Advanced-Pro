import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { GIcon } from '@/components/ui/GoogleIcon';
import { Kpi } from '@/components/ui/Kpi';
import { Spinner } from '@/components/ui/Misc';
import { useToast } from '@/state/ToastState';
import {
  adminAdjustCredits,
  FX_BDT_USD,
  adminAudit,
  adminGrant,
  adminModels,
  adminOrders,
  adminProviders,
  adminReviewOrder,
  adminSettings,
  adminStats,
  adminUsers,
  isFailure,
  setProviderKey,
  termLabel,
  updateModel,
  updatePrice,
  updateProvider,
  updateSetting,
  type AdminStats,
  type AdminUser,
  type AiModel,
  type AiProvider,
  type Order,
  type Setting,
} from '@/lib/pro/api';

type TabId = 'overview' | 'orders' | 'users' | 'plans' | 'providers' | 'settings';

interface AdminOrder extends Order {
  user_id: string;
  sender_hint: string | null;
  contact: string | null;
}

export function AdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [audit, setAudit] = useState<Array<{ id: number; action: string; target: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [statsResult, ordersResult, usersResult, providersResult, modelsResult, settingsResult, auditResult] = await Promise.all([
      adminStats(30),
      adminOrders(),
      adminUsers(),
      adminProviders(),
      adminModels(),
      adminSettings(),
      adminAudit(),
    ]);
    if (!isFailure(statsResult)) setStats(statsResult);
    else setError(statsResult.error);
    if (!isFailure(ordersResult)) setOrders(ordersResult);
    if (!isFailure(usersResult)) setUsers(usersResult);
    if (!isFailure(providersResult)) setProviders(providersResult);
    if (!isFailure(modelsResult)) setModels(modelsResult);
    if (!isFailure(settingsResult)) setSettings(settingsResult);
    if (!isFailure(auditResult)) setAudit(auditResult);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = users.filter((entry) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (entry.email ?? '').toLowerCase().includes(needle) || (entry.display_name ?? '').toLowerCase().includes(needle);
  });

  const pending = orders.filter((order) => order.status === 'submitted' || order.status === 'awaiting');

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Admin console"
        description="Plans, payments, credits and provider keys, all without touching the source."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} icon={<GIcon name="refresh" size={16} />}>
            Refresh
          </Button>
        }
      />

      <div className="mt-4">
        <Tabs<TabId>
          value={tab}
          onChange={setTab}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'orders', label: `Orders${pending.length ? ` (${pending.length})` : ''}` },
            { id: 'users', label: 'Users' },
            { id: 'plans', label: 'Plans' },
            { id: 'providers', label: 'Providers' },
            { id: 'settings', label: 'Settings' },
          ]}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</div>
      )}

      {loading && !stats ? (
        <div className="flex justify-center py-16"><Spinner size={7} /></div>
      ) : (
        <div className="mt-4">
          {tab === 'overview' && stats && <Overview stats={stats} audit={audit} />}
          {tab === 'orders' && <Orders orders={orders} onChange={load} />}
          {tab === 'users' && (
            <Users
              users={filteredUsers}
              search={search}
              onSearch={setSearch}
              onChange={load}
              onToast={(message) => toast.success(message)}
            />
          )}
          {tab === 'plans' && <Plans onToast={(message) => toast.success(message)} />}
          {tab === 'providers' && (
            <Providers
              providers={providers}
              models={models}
              onChange={load}
              onToast={(message, detail) => toast.success(message, detail)}
            />
          )}
          {tab === 'settings' && <Settings settings={settings} onChange={load} onToast={(message) => toast.success(message)} />}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ stats, audit }: { stats: AdminStats; audit: Array<{ id: number; action: string; target: string | null; created_at: string }> }) {
  const fx = stats.api_cost_usd > 0 ? stats.api_cost_bdt / stats.api_cost_usd : 122;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={`৳${stats.revenue_bdt.toLocaleString()}`} icon="storefront" />
        <Kpi label="Provider cost" value={`৳${Math.round(stats.api_cost_bdt).toLocaleString()}`} icon="table_chart" />
        <Kpi label="Margin" value={stats.margin_pct == null ? 'n/a' : `${stats.margin_pct}%`} icon="compare" tone={stats.margin_pct && stats.margin_pct > 40 ? 'ok' : 'default'} />
        <Kpi label="Active plans" value={stats.active_subs.toLocaleString()} icon="workspace_premium" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card flush>
          <CardHeader title="Spend by model" subtitle={`Last ${stats.window_days} days`} icon={<GIcon name="memory" size={18} />} />
          <table className="w-full border-t border-line text-[0.8125rem]">
            <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Model</th>
                <th className="px-4 py-2 text-right font-semibold">Calls</th>
                <th className="px-4 py-2 text-right font-semibold">Tokens</th>
                <th className="px-4 py-2 text-right font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.by_model.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-4 text-2xs text-ink-muted">No API calls yet.</td></tr>
              )}
              {stats.by_model.map((row) => (
                <tr key={row.model_id ?? 'unknown'}>
                  <td className="px-4 py-2 font-medium">{row.model_id ?? 'unknown'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.calls}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-muted">{row.tokens_in + row.tokens_out}</td>
                  <td className="px-4 py-2 text-right tabular-nums">৳{Math.round(row.cost_usd * fx).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Pending work" icon={<GIcon name="schedule" size={18} />} />
            <div className="space-y-1.5 text-[0.8125rem]">
              <Row label="Orders awaiting review" value={stats.orders_pending} />
              <Row label="Approved in window" value={stats.orders_approved} />
              <Row label="Generations" value={stats.generations} />
              <Row label="Failed generations" value={stats.generations_failed} />
              <Row label="Accounts" value={stats.users} />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Recent activity" icon={<GIcon name="checklist" size={18} />} />
            <div className="max-h-48 divide-y divide-line overflow-y-auto border-t border-line">
              {audit.length === 0 && <p className="px-4 py-3 text-2xs text-ink-muted">No actions recorded yet.</p>}
              {audit.slice(0, 8).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 px-4 py-2 text-2xs">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-ink-muted">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Cost fields are typed in taka, saved in the provider's own unit. */
function CostInput({ bdt, onCommit }: { bdt: number; onCommit: (bdt: number) => void }) {
  const [text, setText] = useState(String(bdt));
  useEffect(() => setText(String(bdt)), [bdt]);
  return (
    <Input
      className="w-24"
      value={text}
      inputMode="decimal"
      aria-label="Cost per million tokens in taka"
      onChange={(event) => setText(event.target.value.replace(/[^0-9.]/g, ''))}
      onBlur={() => {
        const value = Number(text);
        if (Number.isFinite(value) && value >= 0) onCommit(value);
        else setText(String(bdt));
      }}
    />
  );
}

/* ---------------------------------------------------------------- orders */

function Orders({ orders, onChange }: { orders: AdminOrder[]; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const review = async (order: AdminOrder, approve: boolean) => {
    setBusy(order.id);
    const result = await adminReviewOrder(order.id, approve, note || undefined);
    setBusy(null);
    if (isFailure(result)) {
      toast.error('Could not update order', result.error);
      return;
    }
    toast.success(approve ? 'Order approved' : 'Order rejected', `${order.plan_slug} · ৳${order.amount_bdt}`);
    setNote('');
    onChange();
  };

  return (
    <Card flush>
      <CardHeader title="Payment orders" subtitle="Approve only after the money has arrived." icon={<GIcon name="description" size={18} />} />
      <div className="border-t border-line">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <Field label="Review note" className="flex-1">
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Verified in bKash statement" />
          </Field>
        </div>
        <div className="divide-y divide-line border-t border-line">
          {orders.length === 0 && <p className="px-4 py-6 text-2xs text-ink-muted">No orders yet.</p>}
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium">
                  {order.plan_slug} · {termLabel(order.months)} · ৳{order.amount_bdt}
                </p>
                <p className="text-2xs text-ink-muted">
                  {order.method}
                  {order.txn_ref ? ` · TrxID ${order.txn_ref}` : ''}
                  {order.sender_hint ? ` · from ${order.sender_hint}` : ''}
                  {' · '}
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  tone={order.status === 'approved' ? 'ok' : order.status === 'rejected' ? 'danger' : order.status === 'submitted' ? 'warn' : 'neutral'}
                >
                  {order.status}
                </Badge>
                {order.status !== 'approved' && order.status !== 'rejected' && (
                  <>
                    <Button size="sm" loading={busy === order.id} onClick={() => void review(order, true)} icon={<GIcon name="check" size={16} />}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void review(order, false)} icon={<GIcon name="close" size={16} />}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- users */

function Users({
  users,
  search,
  onSearch,
  onChange,
  onToast,
}: {
  users: AdminUser[];
  search: string;
  onSearch: (value: string) => void;
  onChange: () => void;
  onToast: (message: string) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [credits, setCredits] = useState('100');
  const [plan, setPlan] = useState('standard');
  const [months, setMonths] = useState('1');

  const apply = async () => {
    if (!editing) return;
    const grant = await adminGrant(editing.user_id, plan, Number(months), 'admin console');
    if (isFailure(grant)) {
      toast.error('Could not grant plan', grant.error);
      return;
    }
    const delta = Number(credits);
    if (Number.isFinite(delta) && delta !== 0) {
      const adjusted = await adminAdjustCredits(editing.user_id, delta, 'admin console');
      if (isFailure(adjusted)) {
        toast.error('Could not adjust credits', adjusted.error);
        return;
      }
    }
    onToast(`${editing.email ?? 'Account'} updated`);
    setEditing(null);
    onChange();
  };

  return (
    <Card flush>
      <CardHeader
        title="Accounts"
        subtitle={`${users.length} shown`}
        icon={<GIcon name="person" size={18} />}
        action={
          <Field label="">
            <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search email or name" />
          </Field>
        }
      />
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[720px] text-[0.8125rem]">
          <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Account</th>
              <th className="px-4 py-2 text-left font-semibold">Plan</th>
              <th className="px-4 py-2 text-right font-semibold">Credits</th>
              <th className="px-4 py-2 text-right font-semibold">Spent</th>
              <th className="px-4 py-2 text-right font-semibold">Jobs</th>
              <th className="px-4 py-2 text-right font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((entry) => (
              <tr key={entry.user_id}>
                <td className="px-4 py-2">
                  <p className="font-medium">{entry.display_name ?? entry.email}</p>
                  <p className="text-2xs text-ink-muted">{entry.email}</p>
                </td>
                <td className="px-4 py-2">
                  {entry.plan ? (
                    <Badge tone="brand">
                      {entry.plan}
                      {entry.expires_at ? ` · ${new Date(entry.expires_at).toLocaleDateString()}` : ''}
                    </Badge>
                  ) : (
                    <span className="text-2xs text-ink-muted">free</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{entry.credits}</td>
                <td className="px-4 py-2 text-right tabular-nums">৳{entry.spent_bdt}</td>
                <td className="px-4 py-2 text-right tabular-nums">{entry.generations}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(entry)}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.email ?? 'Account'} description="Grant a plan or adjust credits. Changes are audited." size="sm">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plan">
                <Input value={plan} onChange={(event) => setPlan(event.target.value)} />
              </Field>
              <Field label="Months">
                <Input value={months} onChange={(event) => setMonths(event.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <Field label="Credit adjustment" hint="negative removes credits">
              <Input value={credits} onChange={(event) => setCredits(event.target.value)} inputMode="numeric" />
            </Field>
            <Button className="w-full" onClick={() => void apply()} icon={<GIcon name="save" size={18} />}>
              Apply
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- plans */

function Plans({ onToast }: { onToast: (message: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Array<{ plan_slug: string; months: number; price_bdt: number; credits: number; active: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { loadCatalog } = await import('@/lib/pro/api');
      const catalog = await loadCatalog();
      setRows(catalog.prices.map((price) => ({
        plan_slug: price.plan_slug,
        months: price.months,
        price_bdt: price.price_bdt,
        credits: price.credits,
        active: price.active,
      })));
      setLoading(false);
    })();
  }, []);

  const save = async (row: (typeof rows)[number]) => {
    const result = await updatePrice(row.plan_slug, row.months, { price_bdt: row.price_bdt, credits: row.credits, active: row.active });
    if (isFailure(result)) {
      toast.error('Could not save', result.error);
      return;
    }
    onToast(`Saved ${row.plan_slug} ${termLabel(row.months)}`);
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size={6} /></div>;

  return (
    <Card flush>
      <CardHeader title="Plans and prices" subtitle="Every term is editable here and takes effect immediately." icon={<GIcon name="sell" size={18} />} />
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[640px] text-[0.8125rem]">
          <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Plan</th>
              <th className="px-4 py-2 text-left font-semibold">Term</th>
              <th className="px-4 py-2 text-left font-semibold">Price (BDT)</th>
              <th className="px-4 py-2 text-left font-semibold">Credits</th>
              <th className="px-4 py-2 text-left font-semibold">Active</th>
              <th className="px-4 py-2 text-right font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={`${row.plan_slug}-${row.months}`}>
                <td className="px-4 py-2 font-medium capitalize">{row.plan_slug}</td>
                <td className="px-4 py-2 text-ink-muted">{termLabel(row.months)}</td>
                <td className="px-4 py-2">
                  <Input
                    className="w-28"
                    value={String(row.price_bdt)}
                    inputMode="numeric"
                    onChange={(event) => setRows((current) => current.map((entry, i) => (i === index ? { ...entry, price_bdt: Number(event.target.value) || 0 } : entry)))}
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    className="w-24"
                    value={String(row.credits)}
                    inputMode="numeric"
                    onChange={(event) => setRows((current) => current.map((entry, i) => (i === index ? { ...entry, credits: Number(event.target.value) || 0 } : entry)))}
                  />
                </td>
                <td className="px-4 py-2">
                  <Switch
                    checked={row.active}
                    onChange={(checked) => setRows((current) => current.map((entry, i) => (i === index ? { ...entry, active: checked } : entry)))}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => void save(row)}>Save</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- providers */

function Providers({
  providers,
  models,
  onChange,
  onToast,
}: {
  providers: AiProvider[];
  models: AiModel[];
  onChange: () => void;
  onToast: (message: string, detail?: string) => void;
}) {
  const toast = useToast();
  const [keyFor, setKeyFor] = useState<AiProvider | null>(null);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);

  const saveKey = async () => {
    if (!keyFor) return;
    setBusy(true);
    const result = await setProviderKey(keyFor.id, secret.trim());
    setBusy(false);
    if (isFailure(result)) {
      toast.error('Could not save key', result.error);
      return;
    }
    onToast('Key stored', `Only a hint is shown: ${result.key_hint}`);
    setSecret('');
    setKeyFor(null);
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card flush>
        <CardHeader title="Providers" subtitle="Keys are stored server side and never returned to the browser." icon={<GIcon name="key" size={18} />} />
        <div className="divide-y divide-line border-t border-line">
          {providers.map((provider) => (
            <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-[0.8125rem] font-medium">{provider.label}</p>
                <p className="text-2xs text-ink-muted">
                  {provider.base_url} · {provider.key_hint ? `key ${provider.key_hint}` : 'no key yet'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={provider.enabled}
                  onChange={(checked) => {
                    void updateProvider(provider.id, { enabled: checked }).then(() => {
                      onToast(`${provider.label} ${checked ? 'enabled' : 'disabled'}`);
                      onChange();
                    });
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => setKeyFor(provider)} icon={<GIcon name="key" size={16} />}>
                  Set key
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card flush>
        <CardHeader title="Models" subtitle="Enable, price and retire models without a release." icon={<GIcon name="memory" size={18} />} />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[720px] text-[0.8125rem]">
            <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Model</th>
                <th className="px-4 py-2 text-left font-semibold">Kind</th>
                <th className="px-4 py-2 text-left font-semibold">৳ / 1M in</th>
                <th className="px-4 py-2 text-left font-semibold">৳ / 1M out</th>
                <th className="px-4 py-2 text-left font-semibold">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{model.label}</p>
                    <p className="text-2xs text-ink-muted">{model.upstream_id}</p>
                  </td>
                  <td className="px-4 py-2 text-ink-muted">{model.kind}</td>
                  <td className="px-4 py-2">
                    <CostInput bdt={Math.round(model.cost_in_per_mtok * FX_BDT_USD)} onCommit={(bdt) => void updateModel(model.id, { cost_in_per_mtok: bdt / FX_BDT_USD })} />
                  </td>
                  <td className="px-4 py-2">
                    <CostInput bdt={Math.round(model.cost_out_per_mtok * FX_BDT_USD)} onCommit={(bdt) => void updateModel(model.id, { cost_out_per_mtok: bdt / FX_BDT_USD })} />
                  </td>
                  <td className="px-4 py-2">
                    <Switch
                      checked={model.enabled}
                      onChange={(checked) => {
                        void updateModel(model.id, { enabled: checked }).then(() => {
                          onToast(`${model.label} ${checked ? 'enabled' : 'disabled'}`);
                          onChange();
                        });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {keyFor && (
        <Modal open onClose={() => setKeyFor(null)} title={`${keyFor.label} key`} description="The value is written on the server and never returned." size="sm">
          <div className="space-y-3">
            <Field label="API key">
              <Input value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="sk-..." />
            </Field>
            <Button className="w-full" loading={busy} onClick={() => void saveKey()} icon={<GIcon name="save" size={18} />}>
              Store key
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- settings */

function Settings({
  settings,
  onChange,
  onToast,
}: {
  settings: Setting[];
  onChange: () => void;
  onToast: (message: string) => void;
}) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const setting of settings) next[setting.key] = JSON.stringify(setting.value, null, 2);
    setDrafts(next);
  }, [settings]);

  const save = async (key: string) => {
    try {
      const parsed = JSON.parse(drafts[key]);
      const result = await updateSetting(key, parsed);
      if (isFailure(result)) {
        toast.error('Could not save', result.error);
        return;
      }
      onToast(`${key} updated`);
      onChange();
    } catch {
      toast.error('Invalid JSON', 'Fix the syntax before saving.');
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {settings.map((setting) => (
        <Card key={setting.key} className="flex flex-col">
          <CardHeader title={setting.label || setting.key} subtitle={setting.key} icon={<GIcon name="tune" size={18} />} />
          <textarea
            value={drafts[setting.key] ?? ''}
            onChange={(event) => setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))}
            spellCheck={false}
            rows={5}
            className="w-full flex-1 rounded-[var(--r-control)] border border-line bg-surface-2 px-3 py-2 font-mono text-[0.75rem] text-ink outline-none focus:border-brand"
          />
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => void save(setting.key)} icon={<GIcon name="save" size={16} />}>
              Save
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
