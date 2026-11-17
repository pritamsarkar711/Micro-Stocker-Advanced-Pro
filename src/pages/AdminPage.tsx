import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { useLicense } from '@/state/LicenseState';
import { licensingClient } from '@/lib/cloud/licensing';
import { date, dateTime } from '@/lib/format';

interface CodeRow {
  id: string;
  kind: string;
  duration_seconds: number;
  created_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  revoked_at: string | null;
}
interface UserRow {
  user_id: string;
  email: string;
  created_at: string;
  expires_at: string | null;
  is_blocked: boolean;
}
interface Stats {
  users_total: number;
  users_active: number;
  users_blocked: number;
  codes_total: number;
  codes_available: number;
  codes_redeemed: number;
}
interface AuditRow {
  id: number;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}


const DURATIONS = [
  { id: '1d', label: '1 day', seconds: 86_400 },
  { id: '7d', label: '7 days', seconds: 604_800 },
  { id: '30d', label: '30 days', seconds: 2_592_000 },
  { id: '90d', label: '90 days', seconds: 7_776_000 },
  { id: '180d', label: '6 months', seconds: 15_552_000 },
  { id: '365d', label: '1 year', seconds: 31_536_000 },
];

function humanDuration(seconds: number): string {
  const days = seconds / 86_400;
  if (days >= 365) return `${Math.round(days / 365)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  if (days >= 1) return `${Math.round(days)}d`;
  return `${Math.round(seconds / 60)}m`;
}

function codeStatus(row: CodeRow): { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' } {
  if (row.revoked_at) return { label: 'Revoked', tone: 'danger' };
  if (row.redeemed_at) return { label: 'Used', tone: 'neutral' };
  return { label: 'Available', tone: 'ok' };
}

function planState(row: UserRow): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  if (row.is_blocked) return { label: 'Blocked', tone: 'danger' };
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now()) return { label: 'Active', tone: 'ok' };
  return { label: 'No plan', tone: 'warn' };
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function AdminPage() {
  const toast = useToast();
  const { refresh: refreshLicense, isAdmin } = useLicense();

  const [tab, setTab] = useState<'codes' | 'users' | 'activity'>('codes');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [kind, setKind] = useState<'premium' | 'trial'>('premium');
  const [durationId, setDurationId] = useState('30d');
  const [customDays, setCustomDays] = useState('30');
  const [quantity, setQuantity] = useState('1');
  const [issued, setIssued] = useState<string[]>([]);

  const [codeQuery, setCodeQuery] = useState('');
  const [codeFilter, setCodeFilter] = useState('all');
  const [userQuery, setUserQuery] = useState('');

  const [grantEmail, setGrantEmail] = useState('');
  const [grantDaysInput, setGrantDaysInput] = useState('30');

  const [expiryUser, setExpiryUser] = useState<UserRow | null>(null);
  const [expiryValue, setExpiryValue] = useState('');

  const client = useMemo(() => licensingClient(), []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError('');
    try {
      const [codeRes, userRes, statsRes, auditRes] = await Promise.all([
        client.rpc('msap_admin_codes'),
        client.rpc('msap_admin_users'),
        client.rpc('msap_admin_stats'),
        client.rpc('msap_admin_audit'),
      ]);
      const failure = codeRes.error || userRes.error || statsRes.error || auditRes.error;
      if (failure) throw new Error(failure.message);
      setCodes((codeRes.data ?? []) as CodeRow[]);
      setUsers((userRes.data ?? []) as UserRow[]);
      setStats(((statsRes.data ?? [])[0] ?? null) as Stats | null);
      setAudit((auditRes.data ?? []) as AuditRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const filteredCodes = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    return codes.filter((row) => {
      const status = codeStatus(row).label.toLowerCase();
      if (codeFilter !== 'all' && status !== codeFilter) return false;
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q) ||
        (row.redeemed_by ?? '').toLowerCase().includes(q)
      );
    });
  }, [codes, codeQuery, codeFilter]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.user_id.includes(q));
  }, [users, userQuery]);

  async function generate() {
    if (!client) return;
    const preset = DURATIONS.find((d) => d.id === durationId);
    const days = durationId === 'custom' ? Number(customDays) : (preset?.seconds ?? 2_592_000) / 86_400;
    const seconds = Math.round(days * 86_400);
    const count = Math.min(25, Math.max(1, Number(quantity) || 1));
    if (!Number.isFinite(seconds) || seconds < 60 || seconds > 315_360_000) {
      setError('Duration must be between 1 minute and 10 years.');
      return;
    }
    setBusy(true);
    setError('');
    setIssued([]);
    try {
      const created: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const { data, error: failure } = await client.rpc('msap_create_code', {
          p_duration_seconds: seconds,
          p_kind: kind,
        });
        if (failure) throw new Error(failure.message);
        const code = (data as { code?: string }[] | null)?.[0]?.code;
        if (!code) throw new Error('The server did not return a code.');
        created.push(code);
      }
      setIssued(created);
      toast.success(`${created.length} code${created.length === 1 ? '' : 's'} created`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code generation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!client) return;
    setBusy(true);
    try {
      const { error: failure } = await client.rpc('msap_admin_revoke_code', { p_id: id });
      if (failure) throw new Error(failure.message);
      toast.info('Code revoked');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke the code.');
    } finally {
      setBusy(false);
    }
  }

  async function grantDays(userId: string, days: number) {
    if (!client) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.rpc('msap_admin_grant_days', { p_user_id: userId, p_days: days });
      if (failure) throw new Error(failure.message);
      toast.success(`${days} days granted`);
      await load();
      await refreshLicense();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the subscription.');
    } finally {
      setBusy(false);
    }
  }

  async function grantByEmail() {
    if (!client) return;
    const days = Number(grantDaysInput);
    if (!grantEmail.trim() || !Number.isFinite(days) || days < 1) {
      setError('Enter an account email and a number of days.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.rpc('msap_admin_grant_email', {
        p_email: grantEmail.trim(),
        p_days: days,
      });
      if (failure) throw new Error(failure.message);
      toast.success('Subscription granted', grantEmail.trim());
      setGrantEmail('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not grant the subscription.');
    } finally {
      setBusy(false);
    }
  }

  async function saveExpiry() {
    if (!client || !expiryUser) return;
    const parsed = new Date(expiryValue);
    if (!Number.isFinite(parsed.getTime())) {
      setError('Choose a valid date and time.');
      return;
    }
    setBusy(true);
    try {
      const { error: failure } = await client.rpc('msap_admin_set_expiry', {
        p_user_id: expiryUser.user_id,
        p_expires_at: parsed.toISOString(),
      });
      if (failure) throw new Error(failure.message);
      toast.success('Expiry updated');
      setExpiryUser(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the expiry.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlocked(user: UserRow) {
    if (!client) return;
    setBusy(true);
    try {
      const { error: failure } = await client.rpc('msap_admin_set_blocked', {
        p_user_id: user.user_id,
        p_blocked: !user.is_blocked,
      });
      if (failure) throw new Error(failure.message);
      toast.info(user.is_blocked ? 'Account unblocked' : 'Account blocked', user.email);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the account status.');
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ['code', 'plan', 'duration'],
      ...issued.map((code) => [code, kind, durationId]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activation-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: 'Accounts', value: stats?.users_total ?? users.length, icon: 'group' as const, tone: 'text-brand' },
    { label: 'Active plans', value: stats?.users_active ?? 0, icon: 'verified' as const, tone: 'text-ok' },
    { label: 'Codes available', value: stats?.codes_available ?? 0, icon: 'confirmation_number' as const, tone: 'text-secondary' },
    { label: 'Codes redeemed', value: stats?.codes_redeemed ?? 0, icon: 'redeem' as const, tone: 'text-ink-muted' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Console"
        description="Issue access codes, manage subscriptions and control accounts."
        actions={
          <>
            <Button size="sm" variant="outline" icon={<GIcon name="refresh" size={18} />} onClick={() => void load()} loading={loading}>
              Refresh
            </Button>
            <Button size="sm" variant="secondary" icon={<GIcon name="cloud_sync" size={18} />} onClick={() => { window.location.hash = '#/cloud'; }}>
              Cloud
            </Button>
          </>
        }
      />

      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3.5 py-3 text-[0.8125rem] font-medium text-danger">
          <GIcon name="cancel" size={18} className="mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
            <GIcon name="close" size={17} />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="card px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-muted">{card.label}</span>
              <span className={clsx('inline-flex size-8 items-center justify-center rounded-[var(--r-chip)] bg-surface-2', card.tone)}>
                <GIcon name={card.icon} size={18} />
              </span>
            </div>
            <div className="nums mt-2 text-[1.5rem] leading-none font-bold text-ink">{loading ? '·' : card.value}</div>
          </div>
        ))}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'codes', label: 'Access codes', icon: <GIcon name="confirmation_number" size={18} />, count: codes.length },
          { id: 'users', label: 'Users', icon: <GIcon name="group" size={18} />, count: users.length },
          { id: 'activity', label: 'Activity', icon: <GIcon name="history" size={18} /> },
        ]}
      />

      {tab === 'codes' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Generate codes" icon={<GIcon name="key" size={18} />} />
              <div className="space-y-3.5">
                <Field label="Plan">
                  <Select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as 'premium' | 'trial')}
                    options={[
                      { value: 'premium', label: 'Premium' },
                      { value: 'trial', label: 'Trial' },
                    ]}
                  />
                </Field>
                <div>
                  <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-muted">Duration</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDurationId(d.id)}
                        className={clsx(
                          'rounded-[var(--r-control)] border px-2 py-2 text-[0.75rem] font-semibold transition-colors',
                          durationId === d.id
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDurationId('custom')}
                      className={clsx(
                        'rounded-[var(--r-control)] border px-2 py-2 text-[0.75rem] font-semibold transition-colors',
                        'col-span-3',
                        durationId === 'custom'
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      Custom length
                    </button>
                  </div>
                </div>
                {durationId === 'custom' && (
                  <Field label="Custom days">
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Quantity" hint="Up to 25 per batch.">
                  <Input type="number" min={1} max={25} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </Field>
                <Button block loading={busy} onClick={() => void generate()} icon={<GIcon name="confirmation_number" size={18} />}>
                  Generate
                </Button>
              </div>
            </Card>

            {issued.length > 0 && (
              <Card className="border-ok/40">
                <CardHeader
                  title="New codes"
                  subtitle="Copy now. Codes are stored hashed and cannot be shown again."
                  icon={<GIcon name="check_circle" size={18} />}
                  action={
                    <div className="flex gap-1.5">
                      <Button size="xs" variant="secondary" onClick={async () => { if (await copyText(issued.join('\n'))) toast.success('Codes copied'); }}>
                        Copy all
                      </Button>
                      <Button size="xs" variant="outline" onClick={downloadCsv} icon={<GIcon name="download" size={15} />}>
                        CSV
                      </Button>
                    </div>
                  }
                />
                <ul className="space-y-1.5">
                  {issued.map((code) => (
                    <li key={code} className="flex items-center gap-2 rounded-[var(--r-chip)] border border-line bg-surface-2 px-2.5 py-1.5">
                      <code className="min-w-0 flex-1 truncate font-mono text-[0.75rem] tracking-[0.05em] text-ink">{code}</code>
                      <button
                        type="button"
                        aria-label="Copy code"
                        onClick={async () => { if (await copyText(code)) toast.success('Code copied'); }}
                        className="text-ink-muted hover:text-brand"
                      >
                        <GIcon name="content_copy" size={17} />
                      </button>
                      <a
                        aria-label="Share by email"
                        href={`mailto:?subject=Your%20Micro%20Stocker%20activation%20code&body=Activation%20code%3A%20${code}`}
                        className="text-ink-muted hover:text-brand"
                      >
                        <GIcon name="mail" size={17} />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader
              title="Issued codes"
              icon={<GIcon name="receipt_long" size={18} />}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    placeholder="Search"
                    className="w-40"
                    size="sm"
                  />
                  <Select
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    aria-label="Filter codes"
                    size="sm"
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'available', label: 'Available' },
                      { value: 'used', label: 'Used' },
                      { value: 'revoked', label: 'Revoked' },
                    ]}
                  />
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left text-[0.8125rem]">
                <thead className="text-[0.75rem] font-semibold tracking-wide text-ink-faint uppercase">
                  <tr>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Length</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map((row) => {
                    const status = codeStatus(row);
                    return (
                      <tr key={row.id} className="border-t border-line">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">{date(row.created_at)}</td>
                        <td className="py-2.5 pr-3 capitalize text-ink">{row.kind}</td>
                        <td className="py-2.5 pr-3 text-ink-muted">{humanDuration(row.duration_seconds)}</td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          {!row.redeemed_at && !row.revoked_at ? (
                            <Button size="xs" variant="ghost" onClick={() => void revoke(row.id)}>
                              Revoke
                            </Button>
                          ) : (
                            <span className="text-[0.75rem] text-ink-faint">
                              {row.redeemed_at ? date(row.redeemed_at) : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCodes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[0.8125rem] text-ink-muted">
                        {loading ? 'Loading…' : 'No codes match this filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Grant by email" icon={<GIcon name="workspace_premium" size={18} />} />
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-56 flex-1">
                <Field label="Account email">
                  <Input
                    type="email"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    placeholder="user@example.com"
                    leading={<GIcon name="mail" size={18} />}
                  />
                </Field>
              </div>
              <div className="w-28">
                <Field label="Days">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={grantDaysInput}
                    onChange={(e) => setGrantDaysInput(e.target.value)}
                  />
                </Field>
              </div>
              <Button loading={busy} onClick={() => void grantByEmail()} icon={<GIcon name="add_circle" size={18} />}>
                Grant
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Accounts"
              icon={<GIcon name="group" size={18} />}
              action={
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search email"
                  className="w-56"
                  size="sm"
                  leading={<GIcon name="search" size={17} />}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-[0.8125rem]">
                <thead className="text-[0.75rem] font-semibold tracking-wide text-ink-faint uppercase">
                  <tr>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Joined</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((row) => {
                    const state = planState(row);
                    return (
                      <tr key={row.user_id} className="border-t border-line align-middle">
                        <td className="py-2.5 pr-3">
                          <div className="max-w-[16rem] truncate font-medium text-ink">{row.email || 'Not set'}</div>
                          <div className="font-mono text-2xs text-ink-faint">{row.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">{date(row.created_at)}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-ink-muted">
                          {row.expires_at ? dateTime(row.expires_at) : 'Not set'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="xs" variant="secondary" onClick={() => void grantDays(row.user_id, 30)}>
                              +30d
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setExpiryUser(row);
                                setExpiryValue(
                                  row.expires_at
                                    ? new Date(row.expires_at).toISOString().slice(0, 16)
                                    : new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16),
                                );
                              }}
                            >
                              Expiry
                            </Button>
                            <Button
                              size="xs"
                              variant={row.is_blocked ? 'success' : 'ghost'}
                              onClick={() => void toggleBlocked(row)}
                            >
                              {row.is_blocked ? 'Unblock' : 'Block'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[0.8125rem] text-ink-muted">
                        {loading ? 'Loading…' : 'No accounts found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'activity' && (
        <Card>
          <CardHeader title="Recent activity" icon={<GIcon name="history" size={18} />} />
          {audit.length === 0 ? (
            <p className="py-6 text-center text-[0.8125rem] text-ink-muted">No administrator actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {audit.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Badge tone="brand">{row.action.replace(/_/g, ' ')}</Badge>
                  <span className="text-[0.8125rem] text-ink">{row.target_email || 'account'}</span>
                  {typeof row.detail?.days === 'number' && (
                    <span className="text-[0.75rem] text-ink-muted">+{String(row.detail.days)} days</span>
                  )}
                  <span className="ml-auto text-[0.75rem] text-ink-faint">{dateTime(row.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={Boolean(expiryUser)}
        onClose={() => setExpiryUser(null)}
        title="Set plan expiry"
        description={expiryUser?.email}
        size="sm"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setExpiryUser(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void saveExpiry()}>
              Save
            </Button>
          </div>
        }
      >
        <Field label="Expires at" hint="Use a past date to remove premium access.">
          <Input type="datetime-local" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
