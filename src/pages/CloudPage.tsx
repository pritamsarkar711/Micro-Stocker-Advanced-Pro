import { useEffect, useState } from 'react';
import {
  Cloud,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Save,
  Trash2,
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
import { pushLibrary, pullLibrary } from '@/lib/stock/sync';
import { useLibrary } from '@/state/library';

export function CloudPage() {
  const { cloud, saveCloud, clearCloud, connection, recheckConnection, ready } = useApp();
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
      ? 'Format: https://<ref>.supabase.co'
      : undefined;
  const keyIssue =
    anonKey && anonKey.trim().length < 40
      ? 'Key looks too short'
      : anonKey.includes('service_role')
        ? 'Use the anon key, never service_role'
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
    if (result.state === 'online') toast.success('Reachable');
    else if (result.state === 'error') toast.error('Test failed', result.message);
    else toast.info('Local mode');
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
    if (ok) toast.success('Connected');
    else toast.warning('Saved, test failed');
  };

  const active = report ?? connection;

  return (
    <>
      <PageHeader
        title="Cloud"
        actions={
          <Badge tone={active.state === 'online' ? 'ok' : active.state === 'error' ? 'danger' : 'neutral'} dot>
            {active.state === 'online' ? 'Synced' : 'Local'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="flex flex-col gap-2 xl:col-span-2">
          <Card
            title="Supabase"
            action={<span className="text-[0.6875rem] text-fg-subtle">Project → API</span>}
          >
            <div className="flex flex-col gap-3">
              <Field label="Project URL" htmlFor="supabase-url" error={urlIssue}>
                <Input
                  id="supabase-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://ref.supabase.co"
                  autoComplete="off"
                  spellCheck={false}
                  invalid={Boolean(urlIssue)}
                  prefix={<Cloud className="size-4" />}
                />
              </Field>

              <Field label="Anon key" htmlFor="supabase-key" error={keyIssue}>
                <div className="relative">
                  <Input
                    id="supabase-key"
                    type={showKey ? 'text' : 'password'}
                    value={anonKey}
                    onChange={(event) => setAnonKey(event.target.value)}
                    placeholder="eyJhbGciOi…"
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-9 font-mono text-xs"
                    invalid={Boolean(keyIssue)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="r-control absolute top-1/2 right-1.5 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <Switch
                id="cloud-enabled"
                checked={enabled}
                onChange={setEnabled}
                label="Use cloud as primary source"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" onClick={onSave} disabled={!canSave} loading={saving} icon={<Save className="size-4" />}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={onTest} loading={testing} icon={<Link2 className="size-4" />}>
                  Test
                </Button>
                <Button
                  size="sm"
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
            title="Library sync"
            action={<Database className="size-4 text-fg-subtle" />}
          >
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                loading={syncing}
                disabled={connection.state !== 'online' || library.items.length === 0}
                onClick={async () => {
                  setSyncing(true);
                  const result = await pushLibrary(cloud, library.items);
                  setSyncing(false);
                  if (result.ok) toast.success('Pushed', `${library.items.length} items`);
                  else toast.error('Push failed', result.error);
                }}
              >
                Push
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
                    toast.success('Merged', `${result.merged.length} items`);
                  } else toast.error('Pull failed', result.error);
                }}
              >
                Pull
              </Button>
            </div>
            <p className="mt-2 text-[0.6875rem] text-fg-subtle">Metadata only — artwork stays local.</p>
          </Card>

          <Card
            title="Schema"
            action={<span className="text-[0.6875rem] text-fg-subtle">SQL Editor → Run</span>}
          >
            <CodeBlock code={SUPABASE_SQL} language="sql" maxHeight="16rem" />
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card title="Status" action={<Cloud className="size-4 text-fg-subtle" />}>
            <div className="flex items-center gap-2">
              <StatusDot state={active.state} />
              <span className="text-[0.8125rem] font-medium text-fg capitalize">{active.state}</span>
              {active.latencyMs !== null && (
                <span className="nums ml-auto text-[0.75rem] text-fg-subtle">{active.latencyMs} ms</span>
              )}
            </div>
            <p className="mt-1.5 text-[0.75rem] text-fg-muted">{active.message}</p>
            {active.hint && (
              <p className="mt-2 r-chip border border-warn/25 bg-warn-soft px-2 py-1 text-[0.75rem] text-warn">
                {active.hint}
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-2.5" onClick={recheckConnection} block>
              Re-check
            </Button>
          </Card>

          <Card title="Credentials">
            <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-fg-muted">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-brand" />
              <span>
                Device only, never uploaded. The anon key is public by design — row-level
                security guards each row.
              </span>
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Disconnect cloud?"
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
                toast.info('Disconnected');
              }}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-[0.8125rem] text-fg-muted">Credentials are removed. Cached data stays.</p>
      </Modal>
    </>
  );
}
