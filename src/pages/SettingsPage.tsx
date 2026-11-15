import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  DatabaseBackup,
  Download,
  Eraser,
  FolderUp,
  HardDrive,
  Keyboard,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  SunMoon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, SegmentedControl, Select, Switch } from '@/components/ui/Field';
import { KeyHint } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { kv } from '@/lib/kv';
import { desktop, isDesktop } from '@/lib/desktop';
import type { CurrencyCode } from '@/lib/format';
import { dateTime } from '@/lib/format';

const SHORTCUTS: [string, string][] = [
  ['Ctrl / ⌘ + K', 'Focus search'],
  ['Ctrl / ⌘ + B', 'Collapse or expand the sidebar'],
  ['Ctrl / ⌘ + =', 'Increase UI scale'],
  ['Ctrl / ⌘ + −', 'Decrease UI scale'],
  ['Ctrl / ⌘ + 0', 'Reset UI scale to 100%'],
  ['Esc', 'Close dialog or navigation drawer'],
];

export function SettingsPage() {
  const { settings, updateSettings, resetSettings, zoom, setZoom, cloud, runtime } = useApp();
  const { aiConfig, setAiConfig } = useLibrary();
  const [aiDraft, setAiDraft] = useState(aiConfig);
  const patchAi = (patch: Partial<typeof aiDraft>) => setAiDraft((prev) => ({ ...prev, ...patch }));
  const toast = useToast();
  const [keys, setKeys] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);

  const refreshKeys = useCallback(async () => {
    setKeys(await kv.keys());
  }, []);

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  const onExport = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: { ...runtime },
      settings,
      uiScale: zoom,
      cloud: {
        url: cloud.url || null,
        provider: cloud.provider,
        anonKey: cloud.anonKey ? `${cloud.anonKey.slice(0, 12)}…(redacted)` : null,
      },
      storedKeys: keys,
    };
    const result = await desktop.fs.exportText({
      defaultName: `micro-stocker-settings-${new Date().toISOString().slice(0, 10)}.json`,
      text: JSON.stringify(payload, null, 2),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.ok) toast.success('Exported', result.filePath ? String(result.filePath) : 'Download started');
    else if (!result.canceled) toast.error('Export failed', result.error);
  };

  /* ---------------- full workspace backup / restore ---------------- */
  const onBackup = async () => {
    setBusy(true);
    const all = await kv.keys();
    const data: Record<string, unknown> = {};
    for (const key of all) data[key] = await kv.get<unknown>(key, null);
    const payload = {
      app: 'micro-stocker-advanced-pro',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      keyCount: all.length,
      data,
    };
    const result = await desktop.fs.exportText({
      defaultName: `micro-stocker-backup-${new Date().toISOString().slice(0, 10)}.json`,
      text: JSON.stringify(payload, null, 2),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    setBusy(false);
    if (result.ok) {
      toast.success('Backup saved', `${all.length} keys · library, releases, planner, bank, sales and settings`);
    } else if (!result.canceled) {
      toast.error('Backup failed', result.error);
    }
  };

  const onRestoreFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, unknown> };
      if (!parsed || typeof parsed !== 'object' || !parsed.data) {
        toast.error('Not a Micro Stocker backup', 'The file has no "data" map.');
        setBusy(false);
        return;
      }
      let count = 0;
      for (const [key, value] of Object.entries(parsed.data)) {
        await kv.set(key, value);
        count++;
      }
      await refreshKeys();
      toast.success(`Restored ${count} keys`, 'Reloading the workspace…');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setBusy(false);
      toast.error('Restore failed', error instanceof Error ? error.message : String(error));
    }
  };

  const onClear = async () => {
    setBusy(true);
    const all = await kv.keys();
    for (const key of all) await kv.del(key);
    await refreshKeys();
    setBusy(false);
    setConfirmClear(false);
    resetSettings();
    toast.success('Local data cleared', 'Settings, cache and cloud credentials were removed from this computer.');
  };

  const keyColumns: Column<{ key: string }>[] = [
    { key: 'key', header: 'Key', primary: true, render: (row) => <span className="font-mono text-xs">{row.key}</span> },
    {
      key: 'kind',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.key.includes('cloud') ? 'brand' : row.key.includes('cache') ? 'warn' : 'neutral'}>
          {row.key.includes('cloud') ? 'credentials' : row.key.includes('cache') ? 'cache' : row.key.includes('settings') ? 'settings' : 'data'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Applied instantly, stored on this computer."
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Download className="size-4" />} onClick={onExport}>
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                resetSettings();
                toast.info('Settings reset', 'Defaults restored on this computer.');
              }}
            >
              Reset
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Appearance" description="Theme, spacing and motion" action={<Palette className="size-4 text-brand" />}>
          <div className="flex flex-col gap-5">
            <Field label="Theme" hint="System follows your Windows light/dark setting automatically.">
              <SegmentedControl
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: 'light', label: 'Light', icon: <SunMoon className="size-3.5" /> },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
                ]}
              />
            </Field>

            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <Switch
                id="density"
                checked={settings.density === 'compact'}
                onChange={(value) => updateSettings({ density: value ? 'compact' : 'comfortable' })}
                label="Compact density"
                description="Tighter rows and padding — more records on screen at once."
              />
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <Switch
                id="reduce-motion"
                checked={settings.reduceMotion}
                onChange={(value) => updateSettings({ reduceMotion: value })}
                label="Reduce motion"
                description="Removes transitions and animations. The OS preference is honoured too."
              />
            </div>

            <Field label="Region / currency" hint="Used for money formatting across reports and invoices.">
              <Select
                value={settings.currency}
                onChange={(event) => updateSettings({ currency: event.target.value as CurrencyCode })}
                options={[
                  { value: 'BDT', label: '৳ Bangladeshi Taka (BDT)' },
                  { value: 'USD', label: '$ US Dollar (USD)' },
                  { value: 'EUR', label: '€ Euro (EUR)' },
                  { value: 'GBP', label: '£ Pound Sterling (GBP)' },
                  { value: 'INR', label: '₹ Indian Rupee (INR)' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card title="Display scale" description="Legibility on any DPI, from 1080p laptops to 4K monitors">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-3xl font-semibold text-fg tabular-nums">
              {Math.round(zoom * 100)}%
            </p>
            <Badge tone={isDesktop ? 'brand' : 'neutral'}>
              {isDesktop ? 'Electron webContents zoom' : 'root font scaling (preview)'}
            </Badge>
          </div>

          <input
            type="range"
            min={0.6}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-4 w-full accent-[var(--brand)]"
            aria-label="UI scale"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((value) => (
              <Button
                key={value}
                size="xs"
                variant={Math.abs(zoom - value) < 0.01 ? 'primary' : 'outline'}
                onClick={() => setZoom(value)}
              >
                {Math.round(value * 100)}%
              </Button>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-fg-muted">
            The layout is rem-based with fluid <code className="font-mono">clamp()</code> typography, so
            scaling up never breaks the grid — it reflows instead. Windows display scaling (125%/150%)
            is handled by Electron itself.
          </p>

          <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Keyboard className="size-4 text-brand" /> Keyboard shortcuts
            </p>
            <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {SHORTCUTS.map(([combo, action]) => (
                <li key={combo} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-fg-muted">{action}</span>
                  <KeyHint>{combo}</KeyHint>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card
          title="AI assistant (optional, your own key)"
          description="The metadata generator works fully offline. If you add an OpenAI-compatible endpoint, generation tries it first and falls back to the local generator."
          action={<Bot className="size-4 text-brand" />}
        >
          <div className="flex flex-col gap-3">
            <Field label="Base URL" hint="e.g. https://api.openai.com/v1 or a local Ollama/LM Studio server">
              <Input value={aiDraft.baseUrl} onChange={(e) => patchAi({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" spellCheck={false} />
            </Field>
            <Field label="API key" hint="Stored only on this computer; sent only to the base URL above.">
              <Input type="password" value={aiDraft.apiKey} onChange={(e) => patchAi({ apiKey: e.target.value })} placeholder="sk-…" spellCheck={false} />
            </Field>
            <Field label="Model">
              <Input value={aiDraft.model} onChange={(e) => patchAi({ model: e.target.value })} placeholder="gpt-4o-mini / llama3.1 / qwen2.5" spellCheck={false} />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { await setAiConfig(aiDraft); toast.success('AI assistant saved', aiDraft.apiKey ? 'Generation will try your endpoint first.' : 'Endpoint cleared — offline generator only.'); }}>
                Save AI settings
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { setAiDraft({ baseUrl: '', apiKey: '', model: '' }); await setAiConfig({ baseUrl: '', apiKey: '', model: '' }); toast.info('AI assistant cleared'); }}>
                Clear
              </Button>
            </div>
          </div>
        </Card>

        <Card
          className="xl:col-span-2"
          title="Data on this computer"
          description="Back up the whole workspace to one JSON file, or restore it on another machine"
          action={
            <Button size="xs" variant="ghost" icon={<RefreshCw className="size-3.5" />} onClick={refreshKeys}>
              Refresh
            </Button>
          }
          flush
        >
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  {isDesktop ? runtime.userDataPath ?? 'Electron userData' : 'Browser localStorage'}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {keys.length} stored key{keys.length === 1 ? '' : 's'} · cloud{' '}
                  {cloud.url ? 'configured' : 'not configured'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Button size="sm" icon={<DatabaseBackup className="size-4" />} loading={busy} onClick={onBackup}>
                Back up
              </Button>
              <Button size="sm" variant="outline" icon={<FolderUp className="size-4" />} disabled={busy} onClick={() => restoreRef.current?.click()}>
                Restore
              </Button>
              <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={onExport}>
                Diagnostics
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Eraser className="size-4" />}
                onClick={() => setConfirmClear(true)}
              >
                Clear local data
              </Button>
            </div>
          </div>

          <DataTable
            rows={keys.map((key) => ({ key }))}
            columns={keyColumns}
            rowKey={(row) => row.key}
            dense
            emptyTitle="No local data yet"
            emptyDescription="Keys appear here as soon as settings, cache or credentials are written."
          />
        </Card>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all local data?"
        description="This removes settings, cached records and the saved Supabase credentials from this computer."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} icon={<Eraser className="size-4" />} onClick={onClear}>
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-fg-muted">
          Data already stored in your Supabase project is <strong className="text-fg">not</strong> touched.
          Last changed: {dateTime(new Date())}.
        </p>
      </Modal>
    </>
  );
}
