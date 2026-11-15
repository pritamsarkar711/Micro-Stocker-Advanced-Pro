import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  DatabaseBackup,
  Download,
  Eraser,
  FolderUp,
  HardDrive,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, SegmentedControl, Select, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { AiPanel } from '@/components/settings/AiPanel';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { kv } from '@/lib/kv';
import { desktop, isDesktop } from '@/lib/desktop';
import type { CurrencyCode } from '@/lib/format';

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Search'],
  ['Ctrl B', 'Sidebar'],
  ['Ctrl +', 'Zoom in'],
  ['Ctrl −', 'Zoom out'],
  ['Ctrl 0', 'Reset zoom'],
  ['Esc', 'Close'],
];

export function SettingsPage() {
  const { settings, updateSettings, resetSettings, zoom, setZoom, cloud, runtime } = useApp();
  const { aiConfig, aiReady, setAiConfig } = useLibrary();
  const toast = useToast();
  const [keys, setKeys] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  const refreshKeys = useCallback(async () => setKeys(await kv.keys()), []);
  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  const onExport = async () => {
    const result = await desktop.fs.exportText({
      defaultName: `micro-stocker-settings-${new Date().toISOString().slice(0, 10)}.json`,
      text: JSON.stringify({ settings, uiScale: zoom, runtime }, null, 2),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.ok) toast.success('Exported');
    else if (!result.canceled) toast.error('Export failed', result.error);
  };

  const onBackup = async () => {
    setBusy(true);
    const all = await kv.keys();
    const data: Record<string, unknown> = {};
    for (const key of all) data[key] = await kv.get<unknown>(key, null);
    const result = await desktop.fs.exportText({
      defaultName: `micro-stocker-backup-${new Date().toISOString().slice(0, 10)}.json`,
      text: JSON.stringify(
        {
          app: 'micro-stocker-advanced-pro',
          backupVersion: 1,
          exportedAt: new Date().toISOString(),
          keyCount: all.length,
          data,
        },
        null,
        2,
      ),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    setBusy(false);
    if (result.ok) toast.success('Backed up', `${all.length} keys`);
    else if (!result.canceled) toast.error('Backup failed', result.error);
  };

  const onRestoreFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, unknown> };
      if (!parsed?.data) {
        toast.error('Invalid backup');
        setBusy(false);
        return;
      }
      let count = 0;
      for (const [key, value] of Object.entries(parsed.data)) {
        await kv.set(key, value);
        count += 1;
      }
      await refreshKeys();
      toast.success(`Restored ${count} keys`);
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setBusy(false);
      toast.error('Restore failed', error instanceof Error ? error.message : String(error));
    }
  };

  const onClear = async () => {
    setBusy(true);
    for (const key of await kv.keys()) await kv.del(key);
    await refreshKeys();
    setBusy(false);
    setConfirmClear(false);
    resetSettings();
    toast.success('Data cleared');
  };

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => { resetSettings(); toast.info('Reset'); }}>
              Reset
            </Button>
            <Button size="sm" variant="outline" icon={<Download className="size-3.5" />} onClick={onExport}>
              Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
        <div className="flex flex-col gap-3 xl:col-span-7">
          <Card title="AI metadata" icon={<BrainCircuit className="size-4" />}>
            <AiPanel settings={aiConfig} onSave={setAiConfig} />
          </Card>

          <Card title="Storage" icon={<HardDrive className="size-4" />}>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[0.75rem] text-fg-muted">
                {isDesktop ? (runtime.userDataPath ?? 'User data') : 'Local storage'}
              </p>
              <Badge tone={cloud.url ? 'ok' : 'neutral'} dot>
                {cloud.url ? 'Cloud' : 'Local'}
              </Badge>
            </div>

            <input
              ref={restoreRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onRestoreFile(file);
                event.target.value = '';
              }}
            />

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button size="sm" icon={<DatabaseBackup className="size-3.5" />} loading={busy} onClick={onBackup}>
                Backup
              </Button>
              <Button size="sm" variant="outline" icon={<FolderUp className="size-3.5" />} disabled={busy} onClick={() => restoreRef.current?.click()}>
                Restore
              </Button>
              <Button size="sm" variant="danger" icon={<Eraser className="size-3.5" />} onClick={() => setConfirmClear(true)}>
                Clear
              </Button>
              <span className="ml-auto self-center text-[0.6875rem] text-fg-subtle">
                {keys.length} keys
              </span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3 xl:col-span-5">
          <Card title="Appearance">
            <div className="flex flex-col gap-3.5">
              <Field label="Theme">
                <SegmentedControl
                  value={settings.theme}
                  onChange={(theme) => updateSettings({ theme })}
                  options={[
                    { value: 'light', label: 'Light', icon: <Sun className="size-3" /> },
                    { value: 'dark', label: 'Dark', icon: <Moon className="size-3" /> },
                    { value: 'system', label: 'Auto', icon: <Monitor className="size-3" /> },
                  ]}
                />
              </Field>

              <Switch
                id="density"
                checked={settings.density === 'compact'}
                onChange={(value) => updateSettings({ density: value ? 'compact' : 'comfortable' })}
                label="Compact rows"
              />
              <Switch
                id="reduce-motion"
                checked={settings.reduceMotion}
                onChange={(value) => updateSettings({ reduceMotion: value })}
                label="Reduce motion"
              />

              <Field label="Currency">
                <Select
                  value={settings.currency}
                  onChange={(event) => updateSettings({ currency: event.target.value as CurrencyCode })}
                  options={[
                    { value: 'USD', label: 'USD $' },
                    { value: 'EUR', label: 'EUR €' },
                    { value: 'GBP', label: 'GBP £' },
                    { value: 'INR', label: 'INR ₹' },
                    { value: 'BDT', label: 'BDT ৳' },
                  ]}
                />
              </Field>
            </div>
          </Card>

          <Card title="Scale">
            <div className="flex items-center gap-2">
              <span className="nums display text-xl font-semibold text-fg">{Math.round(zoom * 100)}%</span>
              <Badge tone={isDesktop ? 'brand' : 'neutral'}>{isDesktop ? 'Native' : 'Preview'}</Badge>
              <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setZoom(1)}>
                Reset
              </Button>
            </div>
            <input
              type="range"
              min={0.6}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-3 w-full accent-[var(--brand)]"
              aria-label="UI scale"
            />
            <div className="mt-3 flex flex-wrap gap-1">
              {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((value) => (
                <Button
                  key={value}
                  size="xs"
                  variant={Math.abs(zoom - value) < 0.01 ? 'primary' : 'outline'}
                  onClick={() => setZoom(value)}
                >
                  {Math.round(value * 100)}
                </Button>
              ))}
            </div>

            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line pt-2.5 sm:grid-cols-2">
              {SHORTCUTS.map(([combo, action]) => (
                <div key={combo} className="flex items-center justify-between gap-2 text-[0.6875rem]">
                  <dt className="text-fg-subtle">{action}</dt>
                  <dd>
                    <kbd className="r-chip border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-fg-muted">
                      {combo}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="AI status">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.75rem] text-fg-muted">Generator</span>
              <Badge tone={aiReady ? 'brand' : 'neutral'} dot>
                {aiReady ? 'AI connected' : 'Built-in'}
              </Badge>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear local data?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} icon={<Eraser className="size-4" />} onClick={onClear}>
              Clear
            </Button>
          </>
        }
      >
        <p className="text-[0.8125rem] text-fg-muted">
          Removes settings, cache and cloud credentials from this computer. Supabase data is untouched.
        </p>
      </Modal>
    </>
  );
}
