import { useMemo, useState } from 'react';
import { Cpu, Download, Gauge, Library as LibraryIcon, Scale, ShieldCheck, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, SegmentedControl, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isDesktop } from '@/lib/desktop';
import { formatBytes, UPSCALABLE_FORMATS } from '@/lib/stock/files';
import type { StockItem } from '@/lib/stock/types';
import { CUSTOM_MODEL_HINT, ENGINE_LICENSE_NOTE, UPSCALE_MODELS } from '@/lib/stock/upscale/models';
import {
  ensureRealEsrgan,
  planScale,
  runUpscale,
  TARGET_PRESETS,
  type EngineId,
  type UpscaleResult,
} from '@/lib/stock/upscale/engine';

interface JobResult extends UpscaleResult {
  id: string;
  sourceName: string;
  outName: string;
  url: string;
}

export function UpscalePage() {
  const library = useLibrary();
  const toast = useToast();

  const [engine, setEngine] = useState<EngineId>('classic');
  const [modelId, setModelId] = useState(UPSCALE_MODELS[0].id);
  const [outFormat, setOutFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [quality, setQuality] = useState(0.92);
  const [presetId, setPresetId] = useState('8k');
  const [itemId, setItemId] = useState<string>('');
  const [engineState, setEngineState] = useState<{
    status: 'idle' | 'checking' | 'ready' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);

  const rasterItems = useMemo(
    () => library.items.filter((item) => (UPSCALABLE_FORMATS as string[]).includes(item.format)),
    [library.items],
  );
  const activeItem: StockItem | undefined =
    rasterItems.find((i) => i.id === itemId) ?? rasterItems[0];

  const preset = TARGET_PRESETS.find((p) => p.id === presetId) ?? TARGET_PRESETS[0];
  const plan = activeItem ? planScale(activeItem, preset) : null;

  const onEnsure = async () => {
    setEngineState({ status: 'checking', message: 'Downloading Real-ESRGAN (43 MB)…' });
    const result = await ensureRealEsrgan((label) =>
      setEngineState({ status: 'checking', message: label }),
    );
    if (result.ok) {
      const count = result.models?.length ?? 0;
      setEngineState({
        status: 'ready',
        message: count
          ? `Ready · ${count} model${count === 1 ? '' : 's'} installed`
          : 'Installed, but no model files were found.',
      });
      if (!count) setEngineState({ status: 'error', message: 'Installed without models — re-install.' });
    } else {
      setEngineState({ status: 'error', message: result.error ?? 'Unknown error' });
    }
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
        tailScale: plan.tailScale,
        outFormat,
        quality,
        onProgress: (ratio, label) => setProgress({ ratio, label }),
      });
      const base = activeItem.name.replace(/\.[^.]+$/, '');
      const outName = `${base}-${result.width}x${result.height}.${outFormat}`;
      setResults((prev) => [
        {
          ...result,
          id: `${Date.now()}`,
          sourceName: activeItem.name,
          outName,
          url: URL.createObjectURL(result.blob),
        },
        ...prev,
      ]);
      const mp = ((result.width * result.height) / 1e6).toFixed(1);
      toast.success(
        `${result.width}×${result.height} · ${mp} MP`,
        `${(result.ms / 1000).toFixed(1)}s · ${engine === 'classic' ? 'resampler' : modelId}`,
      );
    } catch (error) {
      toast.error('Upscale failed', error instanceof Error ? error.message : String(error));
    }
    setProgress(null);
  };

  const engineReady = engine === 'classic' || engineState.status === 'ready';

  return (
    <>
      <PageHeader title="Upscale" />

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Job">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Source">
              <Select
                value={activeItem?.id ?? ''}
                onChange={(e) => setItemId(e.target.value)}
                options={rasterItems.map((i) => ({
                  value: i.id,
                  label: `${i.name} · ${i.width ?? '?'}×${i.height ?? '?'}`,
                }))}
                disabled={rasterItems.length === 0}
              />
            </Field>
            <Field label="Target">
              <Select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                options={TARGET_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
              />
            </Field>
            <Field label="Engine">
              <SegmentedControl
                value={engine}
                onChange={(value) => setEngine(value)}
                options={[
                  { value: 'classic', label: 'Resampler' },
                  { value: 'realesrgan', label: 'AI · GPU' },
                ]}
              />
            </Field>
            <Field label="Output">
              <SegmentedControl
                value={outFormat}
                onChange={(value) => setOutFormat(value)}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'jpg', label: 'JPG' },
                  { value: 'webp', label: 'WebP' },
                ]}
              />
            </Field>
            {engine === 'realesrgan' && (
              <Field label="Model" className="sm:col-span-2">
                <Select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  options={UPSCALE_MODELS.map((m) => ({ value: m.id, label: `${m.label} — ${m.bestFor}` }))}
                />
              </Field>
            )}
            {outFormat !== 'png' && (
              <Field label={`Quality ${Math.round(quality * 100)}%`} className="sm:col-span-2">
                <input
                  type="range"
                  min={0.7}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-[var(--brand)]"
                  aria-label="Output quality"
                />
              </Field>
            )}
          </div>

          {activeItem && plan ? (
            <div className="mt-3 r-control border border-line bg-surface-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-fg-muted">
                <Scale className="size-4 shrink-0 text-brand" />
                <span className="nums">
                  {activeItem.width}×{activeItem.height}
                </span>
                <span className="text-fg-subtle">→</span>
                <strong className="nums text-fg">
                  {Math.round((activeItem.width ?? 0) * plan.finalScale)}×
                  {Math.round((activeItem.height ?? 0) * plan.finalScale)}
                </strong>
                <Badge tone="brand">
                  {plan.passes.join('×')}
                  {plan.tailScale > 1.01 ? ` + ${plan.tailScale.toFixed(2)}×` : ''}
                </Badge>
              </div>
              <p className="mt-1 text-[0.6875rem] text-fg-subtle">{preset.note}</p>
            </div>
          ) : (
            <p className="mt-3 r-control border border-dashed border-line px-3 py-4 text-center text-[0.75rem] text-fg-subtle">
              Import a raster image first
            </p>
          )}

          {engine === 'realesrgan' && (
            <div className="mt-3 r-control border border-line bg-surface-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Cpu className="size-4 shrink-0 text-brand" />
                <p className="min-w-0 flex-1 text-[0.75rem] text-fg-muted">
                  {engineState.status === 'idle'
                    ? isDesktop
                      ? 'One 43 MB download, then runs offline on your GPU.'
                      : 'Needs the Windows desktop build.'
                    : engineState.message}
                </p>
                {isDesktop && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={onEnsure}
                    loading={engineState.status === 'checking'}
                    icon={<Download className="size-3.5" />}
                  >
                    {engineState.status === 'ready' ? 'Re-check' : 'Install'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={onRun}
              disabled={!activeItem || progress !== null || !engineReady}
              icon={<Zap className="size-4" />}
              loading={progress !== null}
            >
              Run
            </Button>
            {progress && (
              <span className="flex min-w-0 items-center gap-2 text-[0.75rem] text-fg-muted">
                <Spinner size={3} />
                <span className="truncate">{progress.label}</span>
              </span>
            )}
            {results.length > 0 && (
              <Badge tone="neutral" icon={<Gauge className="size-3" />}>
                {results.length} done
              </Badge>
            )}
          </div>
        </Card>

        <Card title="Models">
          <ul className="flex flex-col gap-1.5">
            {UPSCALE_MODELS.map((model) => (
              <li
                key={model.id}
                className="flex items-center gap-2 r-control border border-line px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.75rem] font-medium text-fg">{model.label}</p>
                  <p className="truncate text-[0.6875rem] text-fg-subtle">{model.bestFor}</p>
                </div>
                <Badge tone="ok" icon={<ShieldCheck className="size-3" />} className="shrink-0">
                  {model.license}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-fg-subtle">{ENGINE_LICENSE_NOTE}</p>
          <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-fg-subtle">{CUSTOM_MODEL_HINT}</p>
        </Card>
      </div>

      <Card className="mt-3" title="Results" flush>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[0.8125rem] text-fg-subtle">No results yet</p>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((result) => (
              <li key={result.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <img
                  src={result.url}
                  alt={result.outName}
                  className="h-12 w-16 shrink-0 r-chip border border-line object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-fg">{result.outName}</p>
                  <p className="nums mt-0.5 text-[0.6875rem] text-fg-muted">
                    {result.width}×{result.height} · {formatBytes(result.blob.size)} ·{' '}
                    {(result.ms / 1000).toFixed(1)}s
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    icon={<Download className="size-3.5" />}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = result.url;
                      a.download = result.outName;
                      a.click();
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="xs"
                    icon={<LibraryIcon className="size-3.5" />}
                    onClick={async () => {
                      await library.addUpscaled(
                        result.outName,
                        result.blob,
                        result.width,
                        result.height,
                      );
                      toast.success('Added to library');
                    }}
                  >
                    Library
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
