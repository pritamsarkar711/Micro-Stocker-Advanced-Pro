import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Switch } from '@/components/ui/Field';
import { RichSelect } from '@/components/ui/RichSelect';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { useLibrary } from '@/state/library';
import { useAuth } from '@/state/AuthState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';
import {
  DEFAULT_AI,
  generateAiMetadata,
  loadAiSettings,
  PROVIDERS,
  PROVIDER_LIST,
  saveAiSettings,
  syncProviderModels,
  inferModelBrand,
  type AiSettings,
  type ModelPreset,
  type ProviderKind,
} from '@/lib/stock/ai';
import { generateUniversalCsv } from '@/lib/stock/csv';
import type { StockItem, StockFormat } from '@/lib/stock/types';
import { visionBlobForFile } from '@/lib/stock/visionBlobForFile';
import { BrandLogo } from '@/components/ui/BrandLogo';

/** Android-only consolidated Metadata Generator.
 *
 * Replaces Library & Metadata, Prepare, Export & CSV with a single intuitive
 * tool: import EPS/SVG/JPG/PNG, attach an AI provider, generate generic
 * title + keywords, download CSV. Desktop keeps its separate Library/Prepare/
 * Export pages untouched.
 */
export function MetadataGeneratorPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { importFiles } = useLibrary();

  const [files, setFiles] = useState<File[]>([]);
  const [metaById, setMetaById] = useState<
    Record<string, { title: string; keywords: string[]; status: 'idle' | 'generating' | 'done' | 'error'; error?: string }>
  >({});
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI);
  const [busy, setBusy] = useState(false);
  const [liveModels, setLiveModels] = useState<Partial<Record<ProviderKind, ModelPreset[]>>>({});
  const [syncing, setSyncing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadAiSettings().then(setSettings);
  }, []);

  // Persist the provider settings as soon as they change so a key never gets lost.
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveAiSettings(settings), 400);
    return () => window.clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const preset = PROVIDERS[settings.kind];
  const canGenerate = Boolean(user) && files.length > 0;

  // Live free-model discovery: the provider's own /models endpoint is the
  // source of truth, so newly released free vision models show up here
  // without an app update. Falls back to the built-in curated list.
  const availableModels = (() => {
    const synced = liveModels[settings.kind];
    const base = synced && synced.length ? synced : preset.models;
    if (settings.model && !base.some((m) => m.id === settings.model)) {
      return [
        {
          id: settings.model,
          label: settings.model,
          brand: inferModelBrand(settings.model, preset.brand),
          free: true,
        },
        ...base,
      ];
    }
    return base;
  })();

  const handleSyncModels = async () => {
    setSyncing(true);
    try {
      const result = await syncProviderModels(settings);
      if (!result.ok) {
        toast.error('Model sync failed', result.error);
        return;
      }
      setLiveModels((prev) => ({ ...prev, [settings.kind]: result.models }));
      if (result.models.length && !result.models.some((m) => m.id === settings.model)) {
        setSettings((prev) => ({ ...prev, model: result.models[0].id }));
      }
      toast.success(`${result.models.length} models loaded`);
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (fileList: FileList | File[]) => {
    const next = Array.from(fileList).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['eps', 'svg', 'jpg', 'jpeg', 'png'].includes(ext);
    });
    if (next.length === 0) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...next.filter((f) => !names.has(f.name))];
    });
    try {
      await importFiles(next);
    } catch {
      // Library registration is best-effort on this page.
    }
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setMetaById((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const generateOne = async (file: File) => {
    const existing = metaById[file.name];
    if (existing?.status === 'done') return;
    setMetaById((prev) => ({ ...prev, [file.name]: { title: '', keywords: [], status: 'generating' } }));
    try {
      const visionBlob = await visionBlobForFile(file);
      const metadata = await generateAiMetadata(
        {
          name: file.name,
          format: (file.name.split('.').pop()?.toLowerCase() ?? 'jpg') as StockFormat,
          width: 0,
          height: 0,
          flags: { aiGenerated: false, aiTool: '', editorial: false, mature: false, illustration: false, license: 'free' },
          metadata: { title: '', description: '', keywords: [], categories: [] },
        },
        settings,
        { imageBlob: visionBlob },
      );
      setMetaById((prev) => ({ ...prev, [file.name]: { title: metadata.title, keywords: metadata.keywords, status: 'done' } }));
      toast.success('Metadata generated', file.name);
    } catch (err) {
      setMetaById((prev) => ({
        ...prev,
        [file.name]: {
          title: '',
          keywords: [],
          status: 'error',
          error: err instanceof Error ? err.message : 'Generation failed',
        },
      }));
      toast.error('Metadata failed', err instanceof Error ? err.message : String(err));
    }
  };

  const generateAll = async () => {
    setBusy(true);
    for (const file of files) {
      if (metaById[file.name]?.status === 'done') continue;
      await generateOne(file);
    }
    setBusy(false);
  };

  const downloadCsv = () => {
    const rows = files.map((f) => {
      const m = metaById[f.name];
      return {
        ...f,
        metadata: {
          title: m?.title || '',
          description: '',
          keywords: m?.keywords || [],
          categories: [],
        },
      } as unknown as StockItem;
    });
    const { filename, content } = generateUniversalCsv(rows);
    triggerBlobDownload(new Blob([content], { type: 'text/csv;charset=utf-8' }), filename);
    toast.success('CSV downloaded', filename);
  };

  const hasChanges = files.some((f) => {
    const m = metaById[f.name];
    return m && m.status === 'done' && (m.title || m.keywords.length);
  });

  const isAndroidBuild = isAndroid();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metadata Generator"
        description={
          isAndroidBuild ? "Import EPS · SVG · JPG · PNG · Generate title & keywords · Download CSV" : undefined
        }
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".eps,.svg,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleImport(e.target.files);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="secondary" icon={<GIcon name="folder_open" size={16} />} onClick={() => void fileInput.current?.click()}>
              Import files
            </Button>
            {files.length > 0 && (
              <Button size="sm" variant="primary" loading={busy} disabled={!canGenerate || busy} icon={<GIcon name="animation" size={16} />} onClick={generateAll}>
                Generate all
              </Button>
            )}
            {hasChanges && (
              <Button size="sm" variant="secondary" icon={<GIcon name="download" size={16} />} onClick={downloadCsv}>
                Download CSV
              </Button>
            )}
          </>
        }
      />

      {/* AI provider connection (simple) */}
      <Card>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <GIcon name="smart_toy" size={18} className="text-ink-muted" />
            <span className="font-semibold text-ink">AI provider</span>
          </div>
          <span className="text-[0.7rem] text-ink-muted">OpenRouter · Gemini · Groq · NVIDIA · Custom</span>
        </div>
        <div className="grid gap-2 px-4 py-3">
          <Field label="Provider">
            <div className="flex gap-2 flex-wrap">
              {PROVIDER_LIST.map((p) => {
                const active = settings.kind === p.kind;
                const hasKey = Boolean(settings.keys[p.kind]?.trim());
                return (
                  <button
                    key={p.kind}
                    type="button"
                    onClick={() => {
                      const nextModel = p.models[0]?.id || '';
                      setSettings({
                        ...settings,
                        kind: p.kind,
                        model: nextModel,
                        baseUrl: p.kind === 'custom' ? p.baseUrl : '',
                      });
                    }}
                    className={`flex items-center gap-2 rounded-[var(--r-control)] border px-3 py-2.5 text-left transition-colors ${
                      active ? 'border-accent bg-accent-soft/70 text-ink' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60'
                    }`}
                  >
                    <BrandLogo brand={p.brand} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-ink truncate">{p.name}</div>
                      <div className="text-2xs text-ink-muted">{p.badge}</div>
                    </div>
                    {hasKey && <GIcon name="check_circle" size={12} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </Field>

          {(preset.needsKey || preset.optionalKey) && (
            <Field label={`${preset.name} API key`}>
              <Input
                type="password"
                value={settings.keys[settings.kind] ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, keys: { ...settings.keys, [settings.kind]: e.target.value } })
                }
                placeholder={`Paste ${preset.name} key`}
                leading={<GIcon name="key" size={15} />}
              />
            </Field>
          )}

          {settings.kind === 'custom' && (
            <Field label="Server URL">
              <Input
                value={settings.baseUrl}
                onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                placeholder={preset.baseUrl}
                leading={<GIcon name="dns" size={15} />}
              />
            </Field>
          )}

          <Field
            label="Model"
            hint={
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSyncModels()}
                className="inline-flex items-center gap-1 text-accent hover:underline disabled:opacity-50"
              >
                <GIcon name="refresh" size={12} className={syncing ? 'animate-spin' : undefined} />
                {syncing ? 'Loading' : 'Refresh free models'}
              </button>
            }
          >
            <RichSelect
              value={settings.model}
              options={availableModels.map((m) => ({
                value: m.id,
                label: m.label,
                icon: <BrandLogo brand={m.brand} size={15} />,
                badge: m.vision ? 'Vision' : 'Free',
              }))}
              onChange={(modelId) => setSettings({ ...settings, model: modelId })}
            />
          </Field>

          <div className="flex items-end pb-1">
            <Switch
              checked={settings.useVision}
              onChange={(useVision) => setSettings({ ...settings, useVision })}
              label="Read image contents (vision)"
            />
          </div>

          <p className="text-2xs text-ink-faint">Settings save automatically on this device.</p>
        </div>
      </Card>

      {/* Imported files */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-semibold text-ink">Imported files ({files.length})</span>
          {files.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setFiles([])}>
              Clear all
            </Button>
          )}
        </div>
        <div className="divide-y divide-line">
          {files.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-muted">
              <GIcon name="folder_open" size={40} className="mx-auto mb-3 text-ink-faint" />
              <div className="text-sm font-semibold text-ink">No files imported yet</div>
              <div className="mt-1 text-xs">Import EPS, SVG, JPG or PNG to begin.</div>
            </div>
          ) : (
            files.map((file) => {
              const meta = metaById[file.name];
              const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
              return (
                <div key={file.name} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex shrink-0 items-center justify-center size-10 rounded-[var(--r-xs)] border border-line bg-surface-2">
                    <GIcon name={ext === 'EPS' || ext === 'SVG' ? 'description' : 'image'} size={20} className="text-ink-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{file.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge tone="neutral" size="sm">{ext}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {meta?.status === 'generating' && (
                      <span className="flex items-center gap-1 text-[0.7rem] text-ink-muted">
                        <GIcon name="hourglass" size={12} className="animate-spin" />
                        Generating…
                      </span>
                    )}
                    {meta?.status === 'error' && <Badge tone="danger" size="sm">{meta.error ?? 'Error'}</Badge>}
                    <Button
                      size="xs"
                      variant="secondary"
                      loading={meta?.status === 'generating'}
                      disabled={meta?.status === 'generating'}
                      onClick={() => void generateOne(file)}
                    >
                      {meta?.status === 'done' ? 'Regenerate' : 'Generate'}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => removeFile(file.name)} aria-label="Remove">
                      <GIcon name="close" size={14} />
                    </Button>
                  </div>
                  {meta?.status === 'done' && (
                    <div className="w-full border-t border-line mt-3 pt-3 flex flex-wrap gap-3 px-2">
                      <div className="flex items-center gap-1">
                        <GIcon name="title" size={13} className="text-ink-faint" />
                        <span className="text-sm font-semibold text-ink truncate flex-1">{meta.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <GIcon name="local_offer" size={13} className="text-ink-faint" />
                        <span className="text-sm text-ink-muted truncate flex-1">{meta.keywords.join(', ') || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {files.length > 0 && hasChanges && (
        <Card className="bg-ok-soft/30 border border-ok/40">
          <div className="px-4 py-3 flex items-center gap-2">
            <GIcon name="file_download" size={17} className="text-ok" />
            <div>
              <div className="font-semibold text-ink">Metadata ready</div>
              <div className="text-xs text-ink-muted">Download a platform-neutral CSV with title, description and keywords.</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
