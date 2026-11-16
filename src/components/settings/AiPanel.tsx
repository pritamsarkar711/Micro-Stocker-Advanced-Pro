import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Switch } from '@/components/ui/Field';
import { RichSelect, type RichSelectOption } from '@/components/ui/RichSelect';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { desktop } from '@/lib/desktop';
import {
  DEFAULT_AI,
  inferModelBrand,
  loadAiSettings,
  PROVIDER_LIST,
  PROVIDERS,
  pullOllamaModelInApp,
  saveAiSettings,
  syncProviderModels,
  testAiConnection,
  type AiSettings,
  type ModelPreset,
  type ProviderKind,
} from '@/lib/stock/ai';

export interface AiPanelProps {
  compact?: boolean;
  onChange?: (settings: AiSettings) => void;
}

export function AiPanel({ compact = false, onChange }: AiPanelProps) {
  const toast = useToast();
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI);
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [liveModels, setLiveModels] = useState<Partial<Record<ProviderKind, ModelPreset[]>>>({});
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadAiSettings().then(setSettings);
  }, []);

  const preset = PROVIDERS[settings.kind];
  const currentKey = settings.keys[settings.kind] ?? '';

  function commit(next: AiSettings) {
    setSettings(next);
    setTestResult(null);
    void saveAiSettings(next);
    onChange?.(next);
  }

  function selectProvider(kind: ProviderKind) {
    const p = PROVIDERS[kind];
    const remembered = settings.modelsByProvider?.[kind];
    const nextModel = remembered || p.models[0]?.id || '';
    commit({
      ...settings,
      kind,
      model: nextModel,
      baseUrl: kind === 'ollama' || kind === 'custom' ? p.baseUrl : '',
      modelsByProvider: { ...settings.modelsByProvider, [settings.kind]: settings.model },
    });
    setShowKey(false);
  }

  function selectModel(modelId: string) {
    commit({
      ...settings,
      model: modelId,
      modelsByProvider: { ...settings.modelsByProvider, [settings.kind]: modelId },
    });
  }

  const availableModels = useMemo<ModelPreset[]>(() => {
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
  }, [liveModels, preset, settings.kind, settings.model]);

  const modelOptions = useMemo<RichSelectOption[]>(
    () =>
      availableModels.map((m) => ({
        value: m.id,
        label: m.label,
        icon: <BrandLogo brand={m.brand} size={16} />,
        badge: m.vision ? 'Vision' : 'Free',
      })),
    [availableModels],
  );

  async function handleSyncModels() {
    setSyncing(true);
    try {
      const result = await syncProviderModels(settings);
      if (!result.ok) {
        toast.error('Model sync failed', result.error);
        return;
      }
      setLiveModels((prev) => ({ ...prev, [settings.kind]: result.models }));
      if (result.models.length && !result.models.some((m) => m.id === settings.model)) {
        selectModel(result.models[0].id);
      }
      toast.success(
        `${result.models.length} ${settings.kind === 'ollama' ? 'installed' : 'free'} models loaded`,
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnection(settings);
      if (result.ok) {
        const text = `Verified in ${result.latencyMs} ms: "${result.sampleTitle}"`;
        setTestResult({ ok: true, text });
        toast.success(`${preset.name} ready`, `${result.latencyMs} ms response`);
      } else {
        setTestResult({ ok: false, text: result.error });
        toast.error(`${preset.name} check failed`, result.error);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handlePullOllama() {
    const target = (customModel.trim() || settings.model.trim());
    if (!target) return;
    setPulling(true);
    try {
      const res = await pullOllamaModelInApp(settings.baseUrl, target);
      if (!res.ok) {
        toast.error('Ollama install failed', res.error);
        return;
      }
      selectModel(target);
      setCustomModel('');
      toast.success('Model installed in Ollama', target);
      void handleSyncModels();
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={clsx(
          'grid gap-2',
          compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        )}
      >
        {PROVIDER_LIST.map((p) => {
          const active = settings.kind === p.kind;
          const hasKey = Boolean(settings.keys[p.kind]?.trim());
          return (
            <button
              key={p.kind}
              type="button"
              onClick={() => selectProvider(p.kind)}
              className={clsx(
                'flex items-center gap-2.5 rounded-[var(--r-control)] border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-accent bg-accent-soft/70 text-ink'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
              )}
            >
              <BrandLogo brand={p.brand} size={22} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-xs font-semibold text-ink">
                  <span className="truncate">{p.name}</span>
                  {hasKey && <GIcon name="check_circle" size={13} className="shrink-0 text-accent" />}
                </div>
                <div className="truncate text-2xs text-ink-muted">{p.badge}</div>
              </div>
            </button>
          );
        })}
      </div>

      {(preset.needsKey || preset.optionalKey) && (
        <Field
          label={preset.optionalKey ? `${preset.name} API key (optional)` : `${preset.name} API key`}
          hint={
            preset.keyUrl ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-accent hover:underline"
                onClick={() => void desktop.shell.openExternal(preset.keyUrl!)}
              >
                Get free key <GIcon name="open_in_new" size={12} />
              </button>
            ) : undefined
          }
        >
          <Input
            type={showKey ? 'text' : 'password'}
            value={currentKey}
            onChange={(e) =>
              commit({ ...settings, keys: { ...settings.keys, [settings.kind]: e.target.value } })
            }
            placeholder={preset.optionalKey ? 'Leave blank for local server' : `Paste ${preset.name} key`}
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
      )}

      {(settings.kind === 'ollama' || settings.kind === 'custom') && (
        <Field label="Server URL">
          <Input
            value={settings.baseUrl}
            onChange={(e) => commit({ ...settings, baseUrl: e.target.value })}
            placeholder={preset.baseUrl}
            leading={<GIcon name="dns" size={15} />}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label="Model"
          hint={
            settings.kind !== 'local' ? (
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSyncModels()}
                className="inline-flex items-center gap-1 text-accent hover:underline disabled:opacity-50"
              >
                <GIcon name="refresh" size={12} className={syncing ? 'animate-spin' : undefined} />
                {syncing
                  ? 'Loading'
                  : settings.kind === 'ollama'
                    ? 'Detect local models'
                    : 'Refresh free models'}
              </button>
            ) : undefined
          }
        >
          {modelOptions.length > 0 ? (
            <RichSelect
              value={settings.model}
              options={modelOptions}
              onChange={selectModel}
              ariaLabel="AI model"
            />
          ) : (
            <Input
              value={settings.model}
              onChange={(e) => selectModel(e.target.value)}
              placeholder="Enter model ID"
              leading={<BrandLogo brand={preset.brand} size={15} />}
            />
          )}
        </Field>

        {settings.kind !== 'local' && (
          <Field
            label={
              settings.kind === 'ollama' ? 'Install or use custom model' : 'Custom model ID (optional)'
            }
          >
            <div className="flex gap-2">
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={
                  settings.kind === 'ollama'
                    ? 'Example: gemma4:e4b or qwen3:8b'
                    : settings.model || 'Enter model ID'
                }
              />
              {settings.kind === 'ollama' ? (
                <Button
                  variant="secondary"
                  size="md"
                  loading={pulling}
                  icon={<GIcon name="download" size={15} />}
                  onClick={() => void handlePullOllama()}
                >
                  Install
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!customModel.trim()}
                  onClick={() => {
                    selectModel(customModel.trim());
                    setCustomModel('');
                    toast.success('Model selected');
                  }}
                >
                  Use
                </Button>
              )}
            </div>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Keywords (${settings.targetKeywords})`}>
          <input
            type="range"
            min={10}
            max={49}
            value={settings.targetKeywords}
            onChange={(e) => commit({ ...settings, targetKeywords: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </Field>

        <Field label="Style">
          <div className="grid grid-cols-3 gap-1 rounded-[var(--r-control)] border border-line bg-surface-2 p-0.5">
            {(['commercial', 'editorial', 'minimal'] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => commit({ ...settings, tone })}
                className={clsx(
                  'h-8 rounded-[5px] text-xs font-medium capitalize',
                  settings.tone === tone
                    ? 'bg-accent text-accent-fg'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {tone}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-end pb-1">
          <Switch
            checked={settings.useVision}
            onChange={(useVision) => commit({ ...settings, useVision })}
            label="Image vision"
          />
        </div>

        <div className="flex items-end pb-1">
          <Switch
            checked={settings.autoEmbed}
            onChange={(autoEmbed) => commit({ ...settings, autoEmbed })}
            label="Auto embed IPTC & XMP"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={testing}
            icon={<GIcon name="play_arrow" size={16} />}
            onClick={() => void handleTest()}
          >
            Verify provider
          </Button>
          {testResult && (
            <Badge tone={testResult.ok ? 'brand' : 'danger'}>
              <GIcon name={testResult.ok ? 'check_circle' : 'error'} size={13} />
              <span className="max-w-[340px] truncate">{testResult.text}</span>
            </Badge>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <BrandLogo brand={preset.brand} size={15} />
          <span>{preset.name}</span>
          {settings.model && (
            <>
              <span>·</span>
              <span className="max-w-[200px] truncate font-mono text-2xs">{settings.model}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
