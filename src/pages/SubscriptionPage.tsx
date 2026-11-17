import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useLicense } from '@/state/LicenseState';
import { licensingClient } from '@/lib/cloud/licensing';

interface CodeRow { id: string; kind: string; duration_seconds: number; created_at: string; redeemed_at: string | null; redeemed_by: string | null; revoked_at: string | null }
interface UserRow { user_id: string; email: string; created_at: string; expires_at: string | null; is_blocked: boolean }

export function SubscriptionPage() {
  const license = useLicense();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(30);
  const [unit, setUnit] = useState('days');
  const [kind, setKind] = useState('premium');
  const [issued, setIssued] = useState('');
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  async function loadAdmin() {
    const client = licensingClient();
    if (!client) return;
    const [c, u] = await Promise.all([client.rpc('msap_admin_codes'), client.rpc('msap_admin_users')]);
    if (c.error || u.error) { setMessage(c.error?.message || u.error?.message || 'Unable to load admin data'); return; }
    setCodes(c.data as CodeRow[]); setUsers(u.data as UserRow[]);
  }
  useEffect(() => { if (license.isAdmin) void loadAdmin(); }, [license.isAdmin]);
  async function redeem(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await license.redeem(code); setCode(''); setMessage('Code activated.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Activation failed'); }
    finally { setBusy(false); }
  }
  async function generate() {
    const client = licensingClient(); if (!client) return;
    const seconds = duration * (unit === 'hours' ? 3600 : unit === 'days' ? 86400 : 60);
    if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 315360000) { setMessage('Duration must be between one minute and ten years.'); return; }
    setBusy(true); setMessage(''); setIssued('');
    const { data, error } = await client.rpc('msap_create_code', { p_duration_seconds: seconds, p_kind: kind });
    if (error || !data?.[0]?.code) setMessage(error?.message || 'Code generation failed');
    else { setIssued(data[0].code); await loadAdmin(); }
    setBusy(false);
  }
  async function revoke(id: string) {
    const client = licensingClient(); if (!client || !confirm('Revoke this unused code?')) return;
    const { error } = await client.rpc('msap_admin_revoke_code', { p_id: id });
    if (error) setMessage(error.message); else await loadAdmin();
  }
  async function setExpiry(user: UserRow) {
    const input = prompt(`Set expiry for ${user.email} as an ISO date and time (for example 2027-01-01T00:00:00Z). Enter a past date to disable premium.`, user.expires_at || new Date().toISOString());
    if (!input) return;
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) { setMessage('Invalid date'); return; }
    const { error } = await licensingClient()!.rpc('msap_admin_set_expiry', { p_user_id: user.user_id, p_expires_at: date.toISOString() });
    if (error) setMessage(error.message); else { await loadAdmin(); await license.refresh(); }
  }
  async function toggleBlocked(user: UserRow) {
    const action = user.is_blocked ? 'Unblock' : 'Block';
    if (!confirm(`${action} ${user.email}?`)) return;
    const { error } = await licensingClient()!.rpc('msap_admin_set_blocked', { p_user_id: user.user_id, p_blocked: !user.is_blocked });
    if (error) setMessage(error.message); else await loadAdmin();
  }
  const seconds = Math.ceil(license.remainingMs / 1000);
  const countdown = `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
  return <div className="space-y-5"><PageHeader title="Subscription" />
    <Card><CardHeader title="Premium access" /><p className="text-sm">{license.loading ? 'Checking…' : license.premium ? `Active · ${countdown} remaining` : 'Not active'}</p>
      {license.expiresAt && <p className="mt-1 text-xs text-ink-muted">Expires {new Date(license.expiresAt).toLocaleString()}</p>}
      {license.error && <p className="mt-2 text-sm text-danger">Unable to verify subscription: {license.error}</p>}
      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => void redeem(e)}><div className="min-w-52 flex-1"><Field label="Activation code"><Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="Paste your code" /></Field></div><Button type="submit" disabled={!code.trim()} loading={busy}>Activate</Button><Button variant="outline" onClick={() => void license.refresh()}>Refresh</Button></form>
      {message && <p role="status" className="mt-3 text-sm text-ink">{message}</p>}
    </Card>
    {license.isAdmin && <><Card><CardHeader title="Administrator · create code" /><div className="flex flex-wrap items-end gap-3"><div><Field label="Duration"><Input type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field></div><label className="text-xs">Unit <select className="rounded border border-line bg-surface p-2 text-ink" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label><label className="text-xs">Type <select className="rounded border border-line bg-surface p-2 text-ink" value={kind} onChange={(e) => setKind(e.target.value)}><option value="premium">Premium</option><option value="trial">Free trial</option></select></label><Button loading={busy} onClick={() => void generate()}>Generate</Button></div>
      {issued && <div className="mt-3 rounded border border-line p-3"><p className="text-xs text-ink-muted">Copy this code now. It cannot be shown again.</p><code className="break-all text-sm">{issued}</code><Button className="ml-3" size="xs" variant="secondary" onClick={() => void navigator.clipboard.writeText(issued)}>Copy</Button></div>}
    </Card><Card><CardHeader title="Codes" /><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Created</th><th>Type</th><th>Duration</th><th>Status</th><th /></tr></thead><tbody>{codes.map((c) => <tr key={c.id} className="border-t border-line"><td className="py-2">{new Date(c.created_at).toLocaleString()}</td><td>{c.kind}</td><td>{c.duration_seconds / 60} min</td><td>{c.revoked_at ? 'Revoked' : c.redeemed_at ? 'Used' : 'Available'}</td><td>{!c.redeemed_at && !c.revoked_at && <Button size="xs" variant="outline" onClick={() => void revoke(c.id)}>Revoke</Button>}</td></tr>)}</tbody></table></div></Card>
    <Card><CardHeader title="Users & subscriptions" /><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Account</th><th>Expiry</th><th>Status</th><th /></tr></thead><tbody>{users.map((u) => <tr key={u.user_id} className="border-t border-line"><td className="py-2">{u.email}</td><td>{u.expires_at ? new Date(u.expires_at).toLocaleString() : 'None'}</td><td>{u.is_blocked ? 'Blocked' : 'Active'}</td><td><div className="flex gap-1"><Button size="xs" variant="outline" onClick={() => void setExpiry(u)}>Set expiry</Button><Button size="xs" variant="outline" onClick={() => void toggleBlocked(u)}>{u.is_blocked ? 'Unblock' : 'Block'}</Button></div></td></tr>)}</tbody></table></div></Card></>}
  </div>;
}
