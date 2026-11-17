import { useMemo } from 'react';
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
import { GIcon } from '@/components/ui/GoogleIcon';
import { AiPanel } from '@/components/settings/AiPanel';
import { SecurityPanel } from '@/components/auth/SecurityPanel';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { CURRENCIES, type CurrencyCode } from '@/lib/format';
import { desktop } from '@/lib/desktop';

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    resetSettings,
    zoom,
    setZoom,
    nudgeZoom,
  } = useApp();
  const { user, openAuth, logout } = useAuth();
  const { items, replaceAll, clearLibrary } = useLibrary();
  const toast = useToast();

  const currencyOptions = useMemo<RichSelectOption[]>(
    () =>
      CURRENCIES.map((c) => ({
        value: c.code,
        label: `${c.code} (${c.symbol})`,
        sublabel: c.name,
        icon: <CircleFlag code={c.flag} size={18} />,
      })),
    [],
  );

  async function backupLibrary() {
    const payload = JSON.stringify(
      { version: 2, exportedAt: new Date().toISOString(), items },
      null,
      2,
    );
    await desktop.fs.exportText({
      defaultName: `microstocker_backup_${new Date().toISOString().slice(0, 10)}.json`,
      text: payload,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    toast.success('Backup exported');
  }

  async function restoreLibrary() {
    const res = await desktop.fs.openJson<{ items?: typeof items }>();
    if (!res.ok || res.canceled) return;
    if (!Array.isArray(res.value?.items)) {
      toast.error('Invalid backup file');
      return;
    }
    replaceAll(res.value.items);
    toast.success(`Restored ${res.value.items.length} assets`);
  }

  return (
    <div className="space-y-5">
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

      {/* AI providers */}
      <Card>
        <CardHeader title="AI Metadata Providers" icon={<GIcon name="smart_toy" size={17} />} />
        <AiPanel />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Appearance & Region */}
        <Card>
          <CardHeader title="Appearance & Currency" icon={<GIcon name="palette" size={17} />} />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink">Theme</span>
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
              <span className="text-xs font-medium text-ink">Density</span>
              <div className="grid grid-cols-2 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-0.5">
                {(['comfortable', 'compact'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSettings({ density: d })}
                    className={clsx(
                      'h-7 rounded-[5px] px-3 text-xs font-medium capitalize',
                      settings.density === d
                        ? 'bg-accent text-on-brand'
                        : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink">
                Scale ({Math.round(zoom * 100)}%)
              </span>
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

            <Switch
              checked={settings.reduceMotion}
              onChange={(reduceMotion) => updateSettings({ reduceMotion })}
              label="Reduce motion"
            />
          </div>
        </Card>

        {/* Account & Workspace Backup */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Account" icon={<GIcon name="account_circle" size={17} />} />
            {user ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{user.displayName}</div>
                  <div className="truncate text-xs text-ink-muted">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<GIcon name="person" size={15} />}
                    onClick={() => openAuth('account')}
                  >
                    Manage
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<GIcon name="logout" size={15} />}
                    onClick={() => void logout()}
                  >
                    Sign out
                  </Button>
                </div>
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

          {/* Security needs the full row: it holds a password form and a QR code. */}
          <Card className="lg:col-span-2">
            <CardHeader title="Security" icon={<GIcon name="lock" size={17} />} />
            <SecurityPanel />
          </Card>

          <Card>
            <CardHeader title="Workspace Data" icon={<GIcon name="storage" size={17} />} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<GIcon name="download" size={15} />}
                onClick={() => void backupLibrary()}
              >
                Export JSON
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<GIcon name="upload" size={15} />}
                onClick={() => void restoreLibrary()}
              >
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
          </Card>

          <Card>
            <CardHeader title="More" icon={<GIcon name="apps" size={17} />} />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SECONDARY_NAV.map((entry) => (
                <Link
                  key={entry.to}
                  to={entry.to}
                  className="flex items-center gap-2.5 rounded-[var(--r-control)] border border-line px-2.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:border-brand hover:text-ink"
                >
                  <GIcon name={entry.icon} size={17} className="text-ink-faint" />
                  <span className="flex-1 truncate">{entry.label}</span>
                  <GIcon name="chevron_right" size={16} className="text-ink-faint" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
