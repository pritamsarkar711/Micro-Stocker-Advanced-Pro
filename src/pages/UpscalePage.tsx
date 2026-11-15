import { useMemo, useState } from 'react';
import { Cpu, Download, Gauge, Library, Scale, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isDesktop } from '@/lib/desktop';
import { formatBytes, UPSCALABLE_FORMATS } from '@/lib/stock/files';
import type { StockItem } from '@/lib/stock/types';
import { CUSTOM_MODEL_HINT, ENGINE_LICENSE_NOTE, UPSCALE_MODELS } from '@/lib/stock/upscale/models';
import {
  engineAvailability,
  ensureRealEsrgan,
  planScale,
  runUpscale,
  TARGET_PRESETS,
  platformPreset,
  type EngineId,
  type TargetPreset,
  type UpscaleResult,
} from '@/lib/stock/upscale/engine';
import { PLATFORM_LIST } from '@/lib/stock/platforms';

interface JobResult extends UpscaleResult {
  id: string;
  sourceName: string;
  outName: string;
  url: string;
}

export function UpscalePage() {
  const library = useLibrary();
  const toast = useToast();
  const engines = engineAvailability();

  const [engine, setEngine] = useState<EngineId>('classic');
  const [modelId, setModelId] = useState('realesrgan-x4plus');
  const [outFormat, setOutFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [quality, setQuality] = useState(0.92);
  const [presetId, setPresetId] = useState('8k');
  const [itemId, setItemId] = useState<string>('');
  const [engineState, setEngineState] = useState<{ status: 'idle' | 'checking' | 'ready' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);

  const rasterItems = useMemo(() => library.items.filter((item) => (UPSCALABLE_FORMATS as string[]).includes(item.format)), [library.items]);
  const activeItem: StockItem | undefined = rasterItems.find((i) => i.id === itemId) ?? rasterItems[0];

  const presets: TargetPreset[] = useMemo(() => [...TARGET_PRESETS, ...PLATFORM_LIST.map((p) => platformPreset(p.id))], []);
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const plan = activeItem ? planScale(activeItem, preset) : null;

  const onEnsure = async () => {
    setEngineState({ status: 'checking', message: 'Downloading portable Real-ESRGAN (≈ 40 MB)…' });
    const result = await ensureRealEsrgan((label) => setEngineState({ status: 'checking', message: label }));
    if (result.ok) setEngineState({ status: 'ready', message: `Ready at ${result.path} · models: ${result.models?.join(', ') || 'see folder'}` });
    else setEngineState({ status: 'error', message: result.error ?? 'Unknown error' });
  };

  const onRun = async () => {
    if (!activeItem || !plan) return;
    setProgress({ ratio: 0, label: 'Reading source…' });
    try {
      const blob = await library.getItemBlob(activeItem.id);
      const result = await runUpscale(blob, {
        item: activeItem,
        engine,
        modelId,
        passes: plan.passes,
        outFormat,
        quality,
        onProgress: (ratio, label) => setProgress({ ratio, label }),
      });
      const base = activeItem.name.replace(/\.[^.]+$/, '');
      const outName = `${base}-upscaled-${result.width}x${result.height}.${outFormat}`;
      setResults((prev) => [
        { ...result, id: `${Date.now()}`, sourceName: activeItem.name, outName, url: URL.createObjectURL(result.blob) },
        ...prev,
      ]);
      toast.success(`Upscaled to ${result.width}×${result.height}`, `${((result.width * result.height) / 1e6).toFixed(1)} MP via ${engine === 'classic' ? 'built-in resampler' : modelId} in ${(result.ms / 1000).toFixed(1)}s`);
    } catch (error) {
      toast.error('Upscale failed', error instanceof Error ? error.message : String(error));
    }
    setProgress(null);
  };

  return (
    <>
      <PageHeader
        title="Upscale studio"
        description="Enlarge PNG, JPG and WebP locally up to 8K with licence-safe models."
      />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Job">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Source">
              <Select value={activeItem?.id ?? ''} onChange={(e) => setItemId(e.target.value)} options={rasterItems.map((i) => ({ value: i.id, label: `${i.name} (${i.width ?? '?'}×${i.height ?? '?'})` }))} disabled={rasterItems.length === 0} />
            </Field>
            <Field label="Target" hint={preset.note}>
              <Select value={presetId} onChange={(e) => setPresetId(e.target.value)} options={presets.map((p) => ({ value: p.id, label: p.label }))} />
            </Field>
            <Field label="Engine">
              <Select
                value={engine}
                onChange={(e) => setEngine(e.target.value as EngineId)}
                options={engines.map((e) => ({ value: e.id, label: e.available ? e.label : `${e.label} (desktop only)` }))}
              />
            </Field>
            {engine === 'realesrgan' && (
              <Field label="Model">
                <Select value={modelId} onChange={(e) => setModelId(e.target.value)} options={UPSCALE_MODELS.map((m) => ({ value: m.id, label: `${m.label} — ${m.bestFor}` }))} />
              </Field>
            )}
            <Field label="Output format">
              <Select value={outFormat} onChange={(e) => setOutFormat(e.target.value as typeof outFormat)} options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
                { value: 'webp', label: 'WebP' },
              ]} />
            </Field>
            {outFormat !== 'png' && (
              <Field label={`Quality ${Math.round(quality * 100)}%`}>
                <input type="range" min={0.7} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="mt-3 w-full accent-[var(--brand)]" />
              </Field>
            )}
          </div>

          {activeItem && plan && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[0.375rem] border border-line bg-surface-2 p-3 text-xs text-fg-muted">
              <Scale className="size-4 text-brand" />
              <span>
                {activeItem.width}×{activeItem.height} ({((activeItem.width! * activeItem.height!) / 1e6).toFixed(1)} MP)
                {' → '}
                <strong className="text-fg">{Math.round(activeItem.width! * plan.finalScale)}×{Math.round(activeItem.height! * plan.finalScale)}</strong>{' '}
                ({((activeItem.width! * activeItem.height! * plan.finalScale * plan.finalScale) / 1e6).toFixed(1)} MP)
              </span>
              <Badge tone="brand">{plan.passes.join('× → ')} pass{plan.passes.length === 1 ? '' : 'es'}</Badge>
              <span className="opacity-70">{plan.reason}</span>
            </div>
          )}

          {engine === 'realesrgan' && (
            <div className="mt-3 rounded-[0.375rem] border border-line bg-surface-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Cpu className="size-4 text-brand" />
                <p className="flex-1 text-xs text-fg-muted">
                  {engineState.status === 'ready'
                    ? engineState.message
                    : engineState.status === 'error'
                      ? engineState.message
                      : 'Downloads once (≈ 40 MB), then runs offline on your GPU.'}
                </p>
                <Button size="xs" variant="outline" onClick={onEnsure} loading={engineState.status === 'checking'} icon={<Download className="size-3.5" />}>
                  {engineState.status === 'ready' ? 'Re-check' : 'Install'}
                </Button>
              </div>
              {!isDesktop && <p className="mt-2 text-[0.6875rem] text-warn">Desktop build required.</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={onRun} disabled={!activeItem || progress !== null || (engine === 'realesrgan' && engineState.status !== 'ready')} icon={<Zap className="size-4" />} loading={progress !== null}>
              Run
            </Button>
            {progress && (
              <span className="flex items-center gap-2 text-xs text-fg-muted">
                <Spinner size={3} /> {progress.label}
              </span>
            )}
            <Badge tone="neutral" icon={<Gauge className="size-3" />}>8K</Badge>
          </div>
        </Card>

        <Card title="Licences">
          <ul className="flex flex-col gap-2">
            {UPSCALE_MODELS.map((model) => (
              <li key={model.id} className="flex items-start gap-2.5 rounded-[0.375rem] border border-line bg-surface-2 p-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-ok" />
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-medium text-fg">{model.label}</p>
                  <p className="mt-0.5 text-[0.6875rem] text-fg-muted">
                    {model.nativeScale}× · {model.bestFor}
                  </p>
                </div>
                <Badge tone="ok" className="ml-auto shrink-0">OK</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.6875rem] leading-relaxed text-fg-subtle">{CUSTOM_MODEL_HINT}</p>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-fg-subtle">{ENGINE_LICENSE_NOTE}</p>
        </Card>
      </div>

      <Card className="mt-2" title="Results" flush>
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-[0.8125rem] text-fg-subtle">No results</p>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((result) => (
              <li key={result.id} className="flex items-center gap-3 px-3 py-2">
                <img src={result.url} alt={result.outName} className="h-14 w-20 shrink-0 rounded-[0.3rem] border border-line object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{result.outName}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {result.width}×{result.height} · {formatBytes(result.blob.size)} · {(result.ms / 1000).toFixed(1)}s
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="xs" variant="outline" icon={<Download className="size-3.5" />} onClick={() => {
                    const a = document.createElement('a');
                    a.href = result.url;
                    a.download = result.outName;
                    a.click();
                  }}>
                    Download
                  </Button>
                  <Button size="xs" icon={<Library className="size-3.5" />} onClick={async () => {
                    await library.addUpscaled(result.outName, result.blob, result.width, result.height);
                    toast.success('Added');
                  }}>
                    To library
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
