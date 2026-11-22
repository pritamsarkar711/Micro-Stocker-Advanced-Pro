import { useMemo, useSyncExternalStore } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { SECONDARY_NAV } from '@/lib/nav';
import { Button } from '@/components/ui/Button';
import { Field, Switch } from '@/components/ui/Field';
import { RichSelect, type RichSelectOption } from '@/components/ui/RichSelect';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { CircleFlag } from '@/components/ui/CircleFlag';
import { Badge } from '@/components/ui/Badge';
import { GIcon } from '@/components/ui/GoogleIcon';
import { AiPanel } from '@/components/settings/AiPanel';
import { SecurityPanel } from '@/components/auth/SecurityPanel';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useWorkspaceSync } from '@/state/WorkspaceSync';
import { useToast } from '@/state/ToastState';
import { APP_VERSION } from '@/lib/version';
import { isAndroid } from '@/lib/native/platform';
import { subscribeUpdate, updateState, checkUpdates, beginUpdate, restartToInstall, snoozeUpdate } from '@/lib/updateStore';
import { bdtUnit, CURRENCIES, type CurrencyCode } from '@/lib/format';
import { sanitizeBackup } from '@/lib/stock/backup';
import { desktop } from '@/lib/desktop';

export function SettingsPage() {
  const { settings, updateSettings, resetSettings, zoom, setZoom, nudgeZoom } = useApp();
  const { user, openAuth, logout } = useAuth();
  const { items, replaceAll, clearLibrary } = useLibrary();
  const { status } = useWorkspaceSync();
  const toast = useToast();

  const currencyOptions = useMemo<RichSelectOption[]>(
    () =>
      CURRENCIES.map((c) => ({
        value: c.code,
        // Systems without a Bengali font would print "BDT (b)".
        label: c.code === 'BDT' ? `BDT (${bdtUnit()})` : `${c.code} (${c.symbol})`,
        sublabel: c.name,
        icon: <CircleFlag code={c.flag} size={18} />,
      })),
    [],
  );

  async function backupLibrary() {
    const payload = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), items }, null, 2);
    await desktop.fs.exportText({
      defaultName: `microstocker_backup_${new Date().toISOString().slice(0, 10)}.json`,
      text: payload,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    toast.success('Backup exported');
  }

  async function restoreLibrary() {
    const res = await desktop.fs.openJson<unknown>();
    if (!res.ok || res.canceled) return;
    const restored = sanitizeBackup(res.value);
    if (!restored.items.length) {
      toast.error('Invalid backup file', 'No readable assets were found in it.');
      return;
    }
    replaceAll(restored.items);
    const suffix = restored.skipped ? ` · ${restored.skipped} skipped` : '';
    toast.success(
      `Restored ${restored.items.length} assets${suffix}`,
      restored.metadataOnly ? 'Metadata only. File contents stay in the original library.' : undefined,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<GIcon name="restart_alt" size={16} />}
            onClick={() => {
              resetSettings();
              toast.info('Defaults restored');
            }}
          >
            Reset defaults
          </Button>
        }
      />

      <Card>
        <CardHeader title="AI metadata providers" icon={<GIcon name="smart_toy" size={18} />} />
        <AiPanel />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" icon={<GIcon name="palette" size={18} />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-medium">Theme</span>
              <ThemeSwitch />
            </div>
            <Field label="Currency">
              <RichSelect
                value={settings.currency}
                options={currencyOptions}
                onChange={(code) => updateSettings({ currency: code as CurrencyCode })}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-medium">Density</span>
              <div className="grid grid-cols-2 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-0.5">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSettings({ density: d })}
                    className={clsx(
                      'h-7 rounded-[5px] px-3 text-xs font-medium capitalize',
                      settings.density === d ? 'bg-accent text-on-brand' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {isAndroid() ? null : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] font-medium">Scale ({Math.round(zoom * 100)}%)</span>
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="secondary" onClick={() => nudgeZoom(-0.1)} aria-label="Zoom out">
                    <GIcon name="zoom_out" size={15} />
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setZoom(1)}>
                    100%
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => nudgeZoom(0.1)} aria-label="Zoom in">
                    <GIcon name="zoom_in" size={15} />
                  </Button>
                </div>
              </div>
            )}
            <Switch checked={settings.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} label="Reduce motion" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Workflow"
            icon={<GIcon name="tune" size={18} />}
            action={
              <Switch
                checked={settings.confirmRemove}
                onChange={(confirmRemove) => updateSettings({ confirmRemove })}
                label="Confirm deletes"
              />
            }
          />
          {isAndroid() ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Optimizer output">
                <div className="grid grid-cols-5 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-0.5">
                  {(['keep', 'jpg', 'webp', 'avif', 'png'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSettings({ optimizeFormat: value })}
                      className={clsx(
                        'h-7 rounded-[5px] text-2xs font-semibold uppercase',
                        settings.optimizeFormat === value ? 'bg-accent text-on-brand' : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {value === 'keep' ? 'Keep' : value}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Upscaler output">
                <div className="grid grid-cols-3 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-0.5">
                  {(['jpg', 'webp', 'png'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSettings({ upscaleFormat: value })}
                      className={clsx(
                        'h-7 rounded-[5px] text-2xs font-semibold uppercase',
                        settings.upscaleFormat === value ? 'bg-accent text-on-brand' : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Security"
          icon={<GIcon name="lock" size={18} />}
          subtitle="Password and two step verification"
        />
        <SecurityPanel />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Account"
            icon={<GIcon name="account_circle" size={18} />}
            action={
              user ? (
                <Badge tone={status === 'idle' ? 'ok' : 'neutral'} icon={<GIcon name="cloud_sync" size={13} />}>
                  {status === 'idle' ? 'Synced' : 'Local'}
                </Badge>
              ) : undefined
            }
          />
          {user ? (
            <div className="space-y-3">
              <div className="min-w-0">
                <div className="truncate text-[0.875rem] font-semibold">{user.displayName}</div>
                <div className="truncate text-[0.75rem] text-ink-muted">{user.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" icon={<GIcon name="person" size={15} />} onClick={() => openAuth('account')}>
                  Manage
                </Button>
                <Link
                  to="/cloud"
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-line px-3 py-2 text-[0.8125rem] font-semibold hover:border-line-strong hover:bg-surface-2"
                >
                  <GIcon name="cloud_sync" size={15} />
                  Sync &amp; devices
                </Link>
                <Button size="sm" variant="ghost" icon={<GIcon name="logout" size={15} />} onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" icon={<GIcon name="person_add" size={15} />} onClick={() => openAuth('register')}>
                Create account
              </Button>
              <Button size="sm" variant="secondary" icon={<GIcon name="login" size={15} />} onClick={() => openAuth('login')}>
                Sign in
              </Button>
            </div>
          )}
        </Card>

        <UpdatesCard />

        <Card>
          <CardHeader title="Workspace data" icon={<GIcon name="storage" size={18} />} subtitle={`${items.length} files on this device`} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={<GIcon name="download" size={15} />} onClick={() => void backupLibrary()}>
              Export JSON
            </Button>
            <Button size="sm" variant="secondary" icon={<GIcon name="upload" size={15} />} onClick={() => void restoreLibrary()}>
              Import JSON
            </Button>
            {items.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger hover:text-danger"
                icon={<GIcon name="delete" size={15} />}
                onClick={() => {
                  clearLibrary();
                  toast.info('Library cleared');
                }}
              >
                Clear library
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {SECONDARY_NAV.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="flex items-center gap-2.5 rounded-[var(--r-control)] border border-line px-2.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:border-brand hover:text-ink"
              >
                <GIcon name={entry.icon} size={16} className="text-ink-faint" />
                <span className="flex-1 truncate">{entry.label}</span>
                <GIcon name="chevron_right" size={15} className="text-ink-faint" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Update status and the manual check, in plain language. */
function UpdatesCard() {
  const state = useSyncExternalStore(subscribeUpdate, updateState, updateState);
  const checking = state.phase === 'checking';
  const update = state.update;
  const available = Boolean(update) && (state.phase === 'available' || state.phase === 'ready');

  return (
    <Card>
      <CardHeader
        title="Updates"
        icon={<GIcon name="install_desktop" size={18} />}
        subtitle={isAndroid() ? "vecmotion" : `Micro Stocker Advanced Pro ${APP_VERSION}`}
        action={<Badge tone={available ? 'brand' : 'neutral'}>{available ? `${update?.version} ready` : 'Up to date'}</Badge>}
      />
      <div className="space-y-2.5 text-[0.8125rem] text-ink-muted">
        {available ? (
          <p className="leading-relaxed">Version {update?.version} is available.</p>
        ) : (
          <p className="leading-relaxed">The app checks for new builds and lets you know when one is ready.</p>
        )}

        {state.phase === 'error' && state.message && (
          <p className="rounded-[var(--r-xs)] border border-danger/30 bg-danger-soft px-2 py-1.5 text-2xs text-danger">
            {state.message}
          </p>
        )}
        {state.phase === 'current' && <p className="text-2xs text-ok">You have the latest build.</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {available ? (
            <Button size="sm" icon={<GIcon name="download" size={15} />} onClick={() => void beginUpdate()}>
              Install {update?.version}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              loading={checking}
              icon={<GIcon name="refresh" size={15} />}
              onClick={() => void checkUpdates(true)}
            >
              Check for updates
            </Button>
          )}
          {state.phase === 'ready' && (
            <Button size="sm" variant="secondary" icon={<GIcon name="restart_alt" size={15} />} onClick={() => void restartToInstall()}>
              Restart to finish
            </Button>
          )}
          {available && (
            <Button size="sm" variant="ghost" onClick={() => snoozeUpdate()}>
              Remind me tomorrow
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
