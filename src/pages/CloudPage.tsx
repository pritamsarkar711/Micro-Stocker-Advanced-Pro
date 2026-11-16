import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isConfigured, validateConfig } from '@/lib/cloud/config';
import { SCHEMA_SQL } from '@/lib/cloud/schema';
import { pullLibrary, pushLibrary } from '@/lib/stock/sync';

export function CloudPage() {
  const { cloud, saveCloud, clearCloud, connection, recheckConnection } = useApp();
  const { user, openAuth } = useAuth();
  const { items, replaceAll } = useLibrary();
  const toast = useToast();

  const [url, setUrl] = useState(cloud.supabaseUrl);
  const [anonKey, setAnonKey] = useState(cloud.supabaseAnonKey);
  const [label, setLabel] = useState(cloud.projectLabel ?? '');
  const [showKey, setShowKey] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setUrl(cloud.supabaseUrl);
    setAnonKey(cloud.supabaseAnonKey);
    setLabel(cloud.projectLabel ?? '');
  }, [cloud]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const candidate = {
      supabaseUrl: url.trim(),
      supabaseAnonKey: anonKey.trim(),
      projectLabel: label.trim(),
    };
    const err = validateConfig(candidate);
    if (err) {
      toast.error('Invalid configuration', err);
      return;
    }
    setSaving(true);
    try {
      const ok = await saveCloud(candidate);
      toast.success(ok ? 'Cloud connected' : 'Configuration saved');
    } finally {
      setSaving(false);
    }
  }

  async function handlePush() {
    setSyncing(true);
    try {
      const res = await pushLibrary(cloud, items);
      if (res.ok) toast.success(`Pushed ${items.length} assets`);
      else toast.error('Push failed', res.error);
    } finally {
      setSyncing(false);
    }
  }

  async function handlePull() {
    setSyncing(true);
    try {
      const res = await pullLibrary(cloud, items);
      if (res.ok) {
        replaceAll(res.merged);
        toast.success(`Merged ${res.merged.length} assets`);
      } else {
        toast.error('Pull failed', res.error);
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cloud Sync"
        actions={
          <Badge tone={connection.state === 'online' ? 'brand' : 'neutral'}>
            <GIcon name={connection.state === 'online' ? 'cloud_done' : 'cloud_off'} size={13} />
            {connection.message}
            {connection.latencyMs !== null ? ` · ${connection.latencyMs} ms` : ''}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            title="Supabase Project"
            icon={<BrandLogo brand="supabase" size={18} />}
            action={
              isConfigured(cloud) && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<GIcon name="refresh" size={14} />}
                  onClick={() => void recheckConnection()}
                >
                  Test
                </Button>
              )
            }
          />

          <form onSubmit={handleSave} className="space-y-3.5">
            <Field label="Project URL">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://project.supabase.co"
                leading={<GIcon name="link" size={15} />}
              />
            </Field>

            <Field label="Anon public key">
              <Input
                type={showKey ? 'text' : 'password'}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="Supabase public key"
                leading={<GIcon name="key" size={15} />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="pointer-events-auto text-ink-muted hover:text-ink"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    <GIcon name={showKey ? 'visibility_off' : 'visibility'} size={15} />
                  </button>
                }
              />
            </Field>

            <Field label="Label (optional)">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Studio workspace"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={saving}
                  icon={<GIcon name="cloud_sync" size={15} />}
                >
                  Save & connect
                </Button>
                {isConfigured(cloud) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => void clearCloud()}
                  >
                    Disconnect
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  icon={<GIcon name="content_copy" size={13} />}
                  onClick={() => {
                    void navigator.clipboard.writeText(SCHEMA_SQL);
                    toast.success('Schema SQL copied');
                  }}
                >
                  Copy SQL
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowSql((v) => !v)}
                >
                  {showSql ? 'Hide SQL' : 'View SQL'}
                </Button>
              </div>
            </div>
          </form>

          {showSql && (
            <pre className="mt-3 max-h-60 overflow-auto rounded-[var(--r-control)] border border-line bg-surface-2/70 p-3 font-mono text-2xs text-ink">
              {SCHEMA_SQL}
            </pre>
          )}
        </Card>

        <div className="space-y-5 lg:col-span-5">
          <Card>
            <CardHeader title="Account" icon={<GIcon name="account_circle" size={17} />} />
            {user ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-ink">{user.displayName}</div>
                  <div className="truncate text-2xs text-ink-muted">{user.email}</div>
                </div>
                <Button size="xs" variant="secondary" onClick={() => openAuth('account')}>
                  Account
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<GIcon name="person_add" size={15} />}
                  onClick={() => openAuth('register')}
                >
                  Create account
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<GIcon name="login" size={15} />}
                  onClick={() => openAuth('login')}
                >
                  Sign in
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Library Sync" icon={<GIcon name="sync" size={17} />} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                loading={syncing}
                disabled={!isConfigured(cloud)}
                icon={<GIcon name="cloud_upload" size={15} />}
                onClick={() => void handlePush()}
              >
                Push ({items.length})
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={syncing}
                disabled={!isConfigured(cloud)}
                icon={<GIcon name="cloud_download" size={15} />}
                onClick={() => void handlePull()}
              >
                Pull & merge
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
