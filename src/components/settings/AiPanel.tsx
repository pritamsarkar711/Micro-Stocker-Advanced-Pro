import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Check,
  Cpu,
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  Server,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, SegmentedControl, Select } from '@/components/ui/Field';
import { useToast } from '@/state/ToastState';
import {
  EMPTY_AI_SETTINGS,
  AI_PROVIDERS,
  getProvider,
  isAiReady,
  probeProvider,
  resolvedBaseUrl,
  resolvedModel,
  type AiProvider,
  type AiSettings,
} from '@/lib/stock/ai';

const PROVIDER_ICON: Record<AiProvider['kind'], typeof Cpu> = {
  local: HardDrive,
  cloud: Sparkles,
  custom: Server,
};

const CREATIVITY = [
  { value: '0.3', label: 'Exact' },
  { value: '0.6', label: 'Balanced' },
  { value: '0.9', label: 'Varied' },
];

const LOCAL_IDS = new Set(['offline', 'ollama', 'openai-compatible']);

/**
 * AI connection panel.
 *
 * Two free routes, both optional: a model on this machine (Ollama, or any
 * OpenAI-compatible local server) or a hosted free tier reachable with the
 * user's own key. The built-in generator works with none of it.
 */
export function AiPanel({
  settings,
  onSave,
}: {
  settings: AiSettings;
  onSave: (next: AiSettings) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<string[]>([]);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => setDraft(settings), [settings]);

  const provider = getProvider(draft.provider);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const ready = isAiReady(draft);
  const patch = (next: Partial<AiSettings>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setTest(null);
  };

  const pickProvider = (id: AiSettings['provider']) => {
    const next = getProvider(id);
    patch({
      provider: id,
      apiKey: draft.provider === id ? draft.apiKey : '',
      baseUrl: '',
      model: id === 'offline' ? '' : draft.model && draft.provider === id ? draft.model : next.defaultModel,
    });
    setDetected([]);
  };

  const save = async () => {
    setBusy(true);
    await onSave(draft);
    setBusy(false);
    toast.success('AI saved', draft.provider === 'offline' ? 'Built-in generator' : provider.label);
  };

  const runTest = async () => {
    setBusy(true);
    setTest(null);
    const result = await probeProvider(draft);
    if (!mounted.current) return;
    setBusy(false);
    setTest({ ok: result.ok, message: result.message });
    if (result.models?.length) setDetected(result.models);
    if (result.ok && result.models?.length && !draft.model.trim()) {
      patch({ model: result.models[0] });
    }
  };

  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    for (const entry of [...detected.map((id) => ({ id, label: id })), ...provider.models]) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      list.push({ value: entry.id, label: entry.label });
    }
    if (draft.model.trim() && !seen.has(draft.model.trim())) {
      list.unshift({ value: draft.model.trim(), label: draft.model.trim() });
    }
    return list;
  }, [detected, provider, draft.model]);

  const groups = [
    { title: 'On this computer', items: AI_PROVIDERS.filter((p) => LOCAL_IDS.has(p.id)) },
    { title: 'Free tiers', items: AI_PROVIDERS.filter((p) => !LOCAL_IDS.has(p.id)) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
            {group.title}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = PROVIDER_ICON[item.kind];
              const active = item.id === draft.provider;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickProvider(item.id)}
                  aria-pressed={active}
                  className={clsx(
                    'group flex items-center gap-2.5 r-control border px-2.5 py-2 text-left transition-colors duration-150',
                    active
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                  )}
                >
                  <span
                    className={clsx(
                      'flex size-7 shrink-0 items-center justify-center r-chip',
                      active ? 'bg-brand text-white' : 'bg-surface-3 text-fg-muted',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-fg">
                      {item.label}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-fg-subtle">
                      {item.kind === 'local' ? 'No key needed' : item.kind === 'custom' ? 'Any server' : 'Your own key'}
                    </span>
                  </span>
                  {active && <Check className="size-3.5 shrink-0 text-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {provider.id !== 'offline' && (
        <div className="r-control border border-line bg-surface-2 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={ready ? 'ok' : 'neutral'} dot>
              {ready ? 'Ready' : 'Needs setup'}
            </Badge>
            <span className="truncate text-[0.6875rem] text-fg-muted">{provider.freeTierNote}</span>
            {provider.keyUrl && (
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-medium text-brand hover:underline"
              >
                Get key <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Model">
              {modelOptions.length ? (
                <Select
                  value={resolvedModel(draft)}
                  onChange={(event) => patch({ model: event.target.value })}
                  options={modelOptions}
                />
              ) : (
                <Input
                  value={draft.model}
                  onChange={(event) => patch({ model: event.target.value })}
                  placeholder="model name"
                  spellCheck={false}
                />
              )}
            </Field>

            {provider.kind === 'local' ? (
              <Field label="Endpoint">
                <Input
                  value={draft.baseUrl}
                  onChange={(event) => patch({ baseUrl: event.target.value })}
                  placeholder={provider.baseUrl}
                  spellCheck={false}
                />
              </Field>
            ) : (
              <Field label="API key">
                <Input
                  type="password"
                  value={draft.apiKey}
                  onChange={(event) => patch({ apiKey: event.target.value })}
                  placeholder="Paste key"
                  spellCheck={false}
                  autoComplete="off"
                  prefix={<KeyRound className="size-3.5" />}
                />
              </Field>
            )}

            {provider.editableBaseUrl && provider.kind !== 'local' && (
              <Field label="Endpoint">
                <Input
                  value={draft.baseUrl}
                  onChange={(event) => patch({ baseUrl: event.target.value })}
                  placeholder={provider.baseUrl}
                  spellCheck={false}
                />
              </Field>
            )}

            <Field label="Creativity">
              <SegmentedControl
                size="sm"
                value={String(draft.temperature)}
                onChange={(value) => patch({ temperature: Number(value) })}
                options={CREATIVITY.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </Field>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={save} loading={busy} disabled={!dirty} icon={<Check className="size-4" />}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={runTest} disabled={busy} icon={<Wand2 className="size-4" />}>
              Test
            </Button>
            {provider.id === 'ollama' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={runTest}
                disabled={busy}
                icon={<Cpu className="size-4" />}
              >
                Detect models
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_AI_SETTINGS);
                setDetected([]);
                setTest(null);
              }}
              className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-medium text-fg-subtle hover:text-danger"
            >
              <Trash2 className="size-3" /> Remove
            </button>
          </div>

          {busy && !test && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-fg-muted">
              <Loader2 className="size-3 animate-spin" /> Checking…
            </p>
          )}
          {test && (
            <p
              className={clsx(
                'mt-2 r-chip px-2 py-1 text-[0.6875rem] leading-relaxed',
                test.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
              )}
            >
              {test.message}
            </p>
          )}
          {test?.ok && detected.length > 0 && (
            <p className="mt-1.5 truncate text-[0.6875rem] text-fg-subtle" title={detected.join(', ')}>
              {detected.length} model{detected.length === 1 ? '' : 's'} detected
            </p>
          )}
        </div>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-fg-subtle">
        {provider.id === 'offline'
          ? 'Built-in generator: filename, folder and keyword bank. Works with no internet and no key.'
          : `Requests go straight from this computer to ${provider.label} at ${resolvedBaseUrl(draft) || 'the default endpoint'}. Keys are stored locally only.`}
      </p>
    </div>
  );
}
