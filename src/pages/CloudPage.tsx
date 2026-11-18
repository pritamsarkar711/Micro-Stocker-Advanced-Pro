import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useWorkspaceSync } from '@/state/WorkspaceSync';
import { deviceLabel } from '@/lib/stock/sync';
import { demoMode } from '@/lib/cloud/demo';

function when(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - Date.parse(iso);
  if (Number.isNaN(delta)) return 'never';
  if (delta < 60_000) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function CloudPage() {
  const { user, openAuth } = useAuth();
  const { items } = useLibrary();
  const { status, lastSyncAt, error, syncNow } = useWorkspaceSync();
  const [working, setWorking] = useState(false);

  const tone = status === 'error' ? 'danger' : status === 'idle' ? 'ok' : 'neutral';
  const label =
    status === 'off' ? 'Signed out' : status === 'pulling' ? 'Pulling' : status === 'pushing' ? 'Saving' : status === 'error' ? 'Not synced' : 'In sync';

  async function run() {
    setWorking(true);
    try {
      const result = await syncNow();
      if (!result.ok && result.error) setWorking(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sync & devices"
        actions={
          <Badge tone={tone} icon={<GIcon name={status === 'error' ? 'cloud_off' : 'cloud_done'} size={13} />}>
            {label}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Workspace" subtitle={`${items.length} files on this device`} icon={<GIcon name="cloud_sync" size={18} />} />
          <dl className="grid grid-cols-2 gap-3 text-[0.8125rem] sm:grid-cols-4">
            <div>
              <dt className="text-2xs text-ink-muted">Account</dt>
              <dd className="mt-0.5 truncate font-medium">{user?.email ?? 'Signed out'}</dd>
            </div>
            <div>
              <dt className="text-2xs text-ink-muted">This device</dt>
              <dd className="mt-0.5 font-medium">{deviceLabel()}</dd>
            </div>
            <div>
              <dt className="text-2xs text-ink-muted">Last sync</dt>
              <dd className="mt-0.5 font-medium">{when(lastSyncAt)}</dd>
            </div>
            <div>
              <dt className="text-2xs text-ink-muted">Files</dt>
              <dd className="mt-0.5 font-medium">{items.length}</dd>
            </div>
          </dl>

          {error && (
            <p className="mt-3 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {user ? (
              <Button onClick={() => void run()} loading={working || status === 'pulling' || status === 'pushing'} icon={<GIcon name="sync" size={18} />}>
                Sync now
              </Button>
            ) : (
              <Button onClick={() => openAuth('login')} icon={<GIcon name="login" size={18} />}>
                Sign in to sync
              </Button>
            )}
            <span className="text-2xs text-ink-muted">
              {demoMode ? 'Demo build: sync is simulated' : 'Changes save automatically about 20 seconds after an edit'}
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="What travels" icon={<GIcon name="storage" size={18} />} />
          <ul className="space-y-2 text-[0.8125rem] text-ink-muted">
            <li className="flex gap-2"><GIcon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />Titles, keywords, flags and platform choices</li>
            <li className="flex gap-2"><GIcon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />Subscriptions and credits, shared with the desktop and the web build</li>
            <li className="flex gap-2"><GIcon name="do_not_disturb_on" size={16} className="mt-0.5 shrink-0 text-ink-faint" />Image and video files stay on the device that imported them</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
