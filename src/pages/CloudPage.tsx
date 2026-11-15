import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Save,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Field, Input, Switch } from '@/components/ui/Field';
import { CodeBlock } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/state/AppState';
import { useToast } from '@/state/ToastState';
import { SUPABASE_SQL } from '@/lib/cloud/schema';
import { testCloudConnection, type ConnectionReport } from '@/lib/cloud/config';
import { dateTime } from '@/lib/format';
import { pushLibrary, pullLibrary } from '@/lib/stock/sync';
import { useLibrary } from '@/state/library';
import { isDesktop } from '@/lib/desktop';

export function CloudPage() {
  const { cloud, saveCloud, clearCloud, connection, recheckConnection, runtime, ready } = useApp();
  const library = useLibrary();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setUrl(cloud.url ?? '');
    setAnonKey(cloud.anonKey ?? '');
    setEnabled(cloud.enabled !== false);
  }, [ready, cloud.url, cloud.anonKey, cloud.enabled]);

  const urlIssue =
    url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url.trim())
      ? 'Expected https://<project-ref>.supabase.co — check for typos, spaces or a missing https://'
      : undefined;

  const keyIssue =
    anonKey && anonKey.trim().length < 40
      ? 'An anon key is normally a long JWT (100+ characters). This looks too short.'
      : anonKey.includes('service_role')
        ? 'This looks like a service_role key. Never ship that inside a desktop app — use the anon key.'
        : undefined;

  const canSave = Boolean(url.trim() && anonKey.trim()) && !urlIssue && !keyIssue;

  const onTest = async () => {
    setTesting(true);
    const result = await testCloudConnection({
      provider: url.trim() ? 'supabase' : 'none',
      url: url.trim(),
      anonKey: anonKey.trim(),
      enabled,
      savedAt: null,
    });
    setReport(result);
    setTesting(false);
    if (result.state === 'online') toast.success('Cloud reachable', result.message);
    else if (result.state === 'error') toast.error('Cloud test failed', result.message);
    else toast.info('Offline mode', result.message);
  };

  const onSave = async () => {
    setSaving(true);
    const ok = await saveCloud({
      provider: 'supabase',
      url: url.trim(),
      anonKey: anonKey.trim(),
      enabled,
      savedAt: null,
    });
    setSaving(false);
    if (ok) toast.success('Cloud saved', 'Credentials stored and connection verified.');
    else toast.warning('Saved with problems', 'Credentials stored, but the connection test failed.');
  };

  const active = report ?? connection;

  return (
    <>
      <PageHeader
        title="Cloud connection"
        description="Optional Supabase sync. Everything runs offline until credentials are added."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              loading={testing}
              icon={<Link2 className="size-4" />}
            >
              Test
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              loading={saving}
              disabled={!canSave}
              icon={<Save className="size-4" />}
            >
              Save & connect
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card
            title="Supabase credentials"
            description="Project Settings → API in your Supabase dashboard"
            action={
              <Badge tone={active.state === 'online' ? 'ok' : active.state === 'error' ? 'danger' : 'neutral'} dot>
                {active.state}
              </Badge>
            }
          >
            <div className="flex flex-col gap-4">
              <Field
                label="Project URL"
                htmlFor="supabase-url"
                required
                error={urlIssue}
                hint="Example: https://abcdefghijk.supabase.co"
              >
                <Input
                  id="supabase-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://your-project-ref.supabase.co"
                  autoComplete="off"
                  spellCheck={false}
                  invalid={Boolean(urlIssue)}
                  prefix={<Cloud className="size-4" />}
                />
              </Field>

              <Field
                label="Anon public key"
                htmlFor="supabase-key"
                required
                error={keyIssue}
                hint="Safe to store in the app: it is a public key protected by Row Level Security."
              >
                <div className="relative">
                  <Input
                    id="supabase-key"
                    type={showKey ? 'text' : 'password'}
                    value={anonKey}
                    onChange={(event) => setAnonKey(event.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-11 font-mono text-xs"
                    invalid={Boolean(keyIssue)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-fg-subtle transition hover:bg-surface-3 hover:text-fg"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <Switch
                  id="cloud-enabled"
                  checked={enabled}
                  onChange={setEnabled}
                  label="Use cloud as the primary data source"
                  description="When off, the app keeps working offline and syncs later."
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button onClick={onSave} disabled={!canSave} loading={saving} icon={<Save className="size-4" />}>
                  Save & connect
                </Button>
                <Button variant="outline" onClick={onTest} loading={testing} icon={<Link2 className="size-4" />}>
                  Test connection
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmClear(true)}
                  disabled={!cloud.url}
                  icon={<Trash2 className="size-4" />}
                  className="sm:ml-auto"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Database schema"
            description="Run once in Supabase Studio → SQL Editor: tables, indexes and RLS policies."
            action={<Badge tone="brand">Postgres</Badge>}
          >
            <CodeBlock code={SUPABASE_SQL} language="sql" maxHeight="22rem" />
            <p className="mt-3 text-xs leading-relaxed text-fg-muted">
              Domain tables (the real Micro Stocker data model) are generated the same way once the
              feature spec is confirmed — you will get one SQL file to paste, no manual clicking.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Connection status" description={active.checkedAt ? `Checked ${dateTime(active.checkedAt)}` : 'Not checked yet'}>
            <div className="flex items-center gap-2.5">
              <StatusDot state={active.state} />
              <p className="text-sm font-semibold text-fg capitalize">{active.state}</p>
              {active.latencyMs !== null && (
                <Badge tone="neutral" className="ml-auto tabular-nums">
                  {active.latencyMs} ms
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{active.message}</p>
            {active.hint && (
              <div className="mt-3 flex gap-2 rounded-lg border border-warn/30 bg-warn-soft p-3 text-xs leading-relaxed text-warn">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{active.hint}</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={recheckConnection} block>
              Re-check saved connection
            </Button>
          </Card>

          <Card title="Where credentials are stored" description="Nothing is sent anywhere except Supabase">
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex gap-2.5">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-fg-muted">
                  {isDesktop ? (
                    <>
                      Desktop: <code className="font-mono text-xs text-fg">{runtime.userDataPath ?? 'userData'}</code>
                      <br />
                      <span className="text-xs">JSON file on your computer only.</span>
                    </>
                  ) : (
                    <>
                      Browser preview: <code className="font-mono text-xs text-fg">localStorage</code>
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                <span className="text-xs leading-relaxed text-fg-muted">
                  Never add a <code className="font-mono">service_role</code> key to a desktop app — it
                  bypasses Row Level Security. Keep it in Supabase Edge Functions instead.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Database className="mt-0.5 size-4 shrink-0 text-ok" />
                <span className="text-xs leading-relaxed text-fg-muted">
                  A write queue (<code className="font-mono">sync_queue</code>) is part of the schema so
                  offline edits can be replayed when the connection returns.
                </span>
              </li>
            </ul>
          </Card>

          <Card title="Library sync" description="Share one metadata library between your computers via kv_store">
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                loading={syncing}
                disabled={connection.state !== 'online'}
                onClick={async () => {
                  setSyncing(true);
                  const result = await pushLibrary(cloud, library.items);
                  setSyncing(false);
                  if (result.ok) toast.success('Library pushed', `${library.items.length} item descriptor(s) uploaded.`);
                  else toast.error('Push failed', result.error);
                }}
              >
                Push library
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={syncing}
                disabled={connection.state !== 'online'}
                onClick={async () => {
                  setSyncing(true);
                  const result = await pullLibrary(cloud, library.items);
                  setSyncing(false);
                  if (result.ok) {
                    library.replaceAll(result.merged);
                    toast.success('Library merged', `${result.merged.length} item(s) after merge (newer updatedAt wins). File bytes stay on each machine.`);
                  } else toast.error('Pull failed', result.error);
                }}
              >
                Pull & merge
              </Button>
              <p className="text-[0.6875rem] leading-relaxed text-fg-muted">
                Descriptors (names, sizes, metadata, flags) sync — not the artwork itself. Merge is last-write-wins per item.
              </p>
            </div>
          </Card>

          <Card title="Offline behaviour" description="What the app does without internet">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
              <CloudOff className="mt-0.5 size-5 shrink-0 text-fg-subtle" />
              <p className="text-xs leading-relaxed text-fg-muted">
                Reads fall back to the last cached copy on this device, writes are queued locally, and
                the status badge in the top bar shows <strong className="text-fg">Offline</strong>. No
                crash, no data loss, no blocking dialog.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Disconnect from Supabase?"
        description="Stored credentials are removed from this computer. Cached data stays."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                await clearCloud();
                setUrl('');
                setAnonKey('');
                setReport(null);
                setConfirmClear(false);
                toast.info('Disconnected', 'The app is back in offline mode.');
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-fg-muted">
          You can reconnect at any time by pasting the URL and anon key again.
        </p>
      </Modal>
    </>
  );
}
