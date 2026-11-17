import { useMemo } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Switch } from '@/components/ui/Field';
import { RichSelect, type RichSelectOption } from '@/components/ui/RichSelect';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { CircleFlag } from '@/components/ui/CircleFlag';
import { GIcon } from '@/components/ui/GoogleIcon';
import { AiPanel } from '@/components/settings/AiPanel';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { CURRENCIES, type CurrencyCode } from '@/lib/format';
import { desktop } from '@/lib/desktop';

export function SettingsPage() {
  const {
    settings,
    setAccentInstant,
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

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink">Primary color</span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'crimson', label: 'Crimson', swatch: '#b3294e' },
                    { id: 'indigo', label: 'Indigo', swatch: '#4829b2' },
                    { id: 'emerald', label: 'Emerald', swatch: '#146c46' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAccentInstant(opt.id)}
                    className={clsx(
                      'inline-flex h-8 items-center gap-2 rounded-[var(--r-control)] border px-3 text-xs font-medium',
                      settings.accent === opt.id
                        ? 'border-accent bg-accent-soft font-semibold text-accent'
                        : 'border-line bg-surface text-ink-muted hover:text-ink',
                    )}
                  >
                    <span
                      className="size-3.5 rounded-full"
                      style={{ backgroundColor: opt.swatch }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Currency">
              <RichSelect
                value={settings.currency}
                options={currencyOptions}
                onChange={(code) => updateSettings({ currency: code as CurrencyCode })}
                ariaLabel="Currency"
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
                <Button size="xs" variant="secondary" onClick={() => nudgeZoom(-0.1)}>
                  <GIcon name="zoom_out" size={15} />
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setZoom(1)}>
                  100%
                </Button>
                <Button size="xs" variant="secondary" onClick={() => nudgeZoom(0.1)}>
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
                  icon={<GIcon name="delete_sweep" size={15} />}
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
        </div>
      </div>
    </div>
  );
}
