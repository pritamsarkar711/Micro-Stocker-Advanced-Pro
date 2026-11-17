import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field } from '@/components/ui/Field';
import { ModelTile } from '@/components/ui/ModelTile';
import { GIcon } from '@/components/ui/GoogleIcon';
import { FormatIcon } from '@/components/ui/FormatIcon';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { desktop, triggerBlobDownload, type ModelProgressEvent } from '@/lib/desktop';
import {
  cancelModelInstall,
  formatBytes,
  installModelInApp,
  listInstalledModels,
  onModelProgress,
  uninstallModelInApp,
} from '@/lib/modelStore';
import {
  buildUpscaleInstallSpec,
  resolveTargetSize,
  UPSCALE_FORMATS,
  UPSCALE_MODELS,
  UPSCALE_PURPOSES,
  UPSCALE_TARGETS,
  type UpscaleModel,
  type UpscalePurpose,
} from '@/lib/stock/upscale/models';
import { runUpscale } from '@/lib/stock/upscale/engine';

interface QueueEntry {
  id: string;
  name: string;
  blob: Blob;
  path?: string;
  srcUrl: string;
  width: number;
  height: number;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  error?: string;
  outBlob?: Blob;
  outUrl?: string;
  outName?: string;
  outW?: number;
  outH?: number;
  outMP?: number;
}

async function readImageDims(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(blob);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return { width: 0, height: 0 };
  }
}

export function UpscalePage() {
  const { items: libItems, getBlob, addGeneratedBlob } = useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [purpose, setPurpose] = useState<UpscalePurpose>('all');
  const [modelId, setModelId] = useState<string>('lanczos-pro');
  const [targetId, setTargetId] = useState<string>('4k');
  const [outFormat, setOutFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [quality, setQuality] = useState(94);

  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [dlProgress, setDlProgress] = useState<Record<string, ModelProgressEvent>>({});
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [running, setRunning] = useState(false);

  const queueRef = useRef<QueueEntry[]>([]);
  queueRef.current = queue;

  useEffect(() => {
    void listInstalledModels().then((map) => {
      const flags: Record<string, boolean> = {};
      for (const id of Object.keys(map)) flags[id] = true;
      setInstalled(flags);
    });
    return onModelProgress((ev) => {
      setDlProgress((prev) => ({ ...prev, [ev.id]: ev }));
      if (ev.phase === 'ready') {
        setInstalled((prev) => ({ ...prev, [ev.id]: true }));
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const entry of queueRef.current) {
        URL.revokeObjectURL(entry.srcUrl);
        if (entry.outUrl) URL.revokeObjectURL(entry.outUrl);
      }
    };
  }, []);

  const activeTarget = useMemo(
    () => UPSCALE_TARGETS.find((t) => t.id === targetId) ?? UPSCALE_TARGETS[0],
    [targetId],
  );
  const activeModel = useMemo(
    () => UPSCALE_MODELS.find((m) => m.id === modelId) ?? UPSCALE_MODELS[0],
    [modelId],
  );

  const filteredModels = useMemo(
    () =>
      purpose === 'all'
        ? UPSCALE_MODELS
        : UPSCALE_MODELS.filter((m) => m.purposes.includes(purpose)),
    [purpose],
  );

  function pickTarget(id: string) {
    setTargetId(id);
    const t = UPSCALE_TARGETS.find((x) => x.id === id);
    if (!t) return;
    if (t.recommendedFormat) setOutFormat(t.recommendedFormat);
    if (t.requireAgencySafe && !activeModel.agencySafe) {
      setModelId('lanczos-pro');
      toast.info(`${t.label} preset selected`, 'Switched to agency compliant Lanczos Pro');
    }
  }

  async function handleInstallModel(model: UpscaleModel) {
    const spec = buildUpscaleInstallSpec(model);
    if (!spec) return;
    const res = await installModelInApp(spec);
    setDlProgress((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    if (res.ok) {
      setInstalled((prev) => ({ ...prev, [model.id]: true }));
      setModelId(model.id);
      toast.success(`${model.name} installed`);
    } else if (!res.canceled) {
      toast.error('Install failed', res.error);
    }
  }

  async function handleUninstallModel(model: UpscaleModel) {
    await uninstallModelInApp(model.id);
    setInstalled((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    if (modelId === model.id) setModelId('lanczos-pro');
    toast.info(`${model.name} removed`);
  }

  async function addFiles(list: FileList | File[]) {
    const entries: QueueEntry[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) continue;
      const { width, height } = await readImageDims(file);
      if (!width || !height) continue;
      entries.push({
        id: `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        blob: file,
        path: (file as File & { path?: string }).path,
        srcUrl: URL.createObjectURL(file),
        width,
        height,
        status: 'queued',
        progress: 0,
      });
    }
    if (entries.length) setQueue((prev) => [...entries, ...prev]);
  }

  async function importFromLibrary() {
    const rasters = libItems.filter((it) => it.format !== 'eps' && it.format !== 'ai' && it.format !== 'svg');
    if (!rasters.length) {
      toast.info('No raster images in Library yet');
      return;
    }
    const added: QueueEntry[] = [];
    for (const it of rasters.slice(0, 24)) {
      const blob = await getBlob(it.id);
      if (!blob) continue;
      const dims = it.width && it.height ? { width: it.width, height: it.height } : await readImageDims(blob);
      if (!dims.width) continue;
      added.push({
        id: `up_${it.id}_${Date.now().toString(36)}`,
        name: it.name,
        blob,
        path: it.path,
        srcUrl: URL.createObjectURL(blob),
        width: dims.width,
        height: dims.height,
        status: 'queued',
        progress: 0,
      });
    }
    if (added.length) {
      setQueue((prev) => [...added, ...prev]);
      toast.success(`Added ${added.length} from Library`);
    }
  }

  function removeEntry(id: string) {
    setQueue((prev) => {
      const hit = prev.find((e) => e.id === id);
      if (hit) {
        URL.revokeObjectURL(hit.srcUrl);
        if (hit.outUrl) URL.revokeObjectURL(hit.outUrl);
      }
      return prev.filter((e) => e.id !== id);
    });
  }

  function clearQueue() {
    for (const e of queue) {
      URL.revokeObjectURL(e.srcUrl);
      if (e.outUrl) URL.revokeObjectURL(e.outUrl);
    }
    setQueue([]);
  }

  async function processAll() {
    if (!queue.length || running) return;
    setRunning(true);
    let completed = 0;
    try {
      for (const entry of queueRef.current) {
        setQueue((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, status: 'running', progress: 0.05, error: undefined } : e)),
        );
        try {
          const result = await runUpscale({
            blob: entry.blob,
            path: entry.path,
            name: entry.name,
            width: entry.width,
            height: entry.height,
            modelId: activeModel.id,
            target: activeTarget,
            outFormat,
            quality: quality / 100,
            onProgress: (ratio) => {
              setQueue((prev) =>
                prev.map((e) => (e.id === entry.id ? { ...e, progress: ratio } : e)),
              );
            },
          });
          const outUrl = URL.createObjectURL(result.blob);
          setQueue((prev) =>
            prev.map((e) => {
              if (e.id !== entry.id) return e;
              if (e.outUrl) URL.revokeObjectURL(e.outUrl);
              return {
                ...e,
                status: 'done',
                progress: 1,
                outBlob: result.blob,
                outUrl,
                outName: result.filename,
                outW: result.width,
                outH: result.height,
                outMP: result.megapixels,
              };
            }),
          );
          completed++;
        } catch (error) {
          setQueue((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                  }
                : e,
            ),
          );
        }
      }
      if (completed > 0) {
        toast.success(`Upscaled ${completed} image${completed === 1 ? '' : 's'}`, activeTarget.label);
      }
    } finally {
      setRunning(false);
    }
  }

  const resolutionTargets = UPSCALE_TARGETS.filter((t) => t.group === 'resolution');
  const agencyTargets = UPSCALE_TARGETS.filter((t) => t.group === 'platform');
  const doneEntries = queue.filter((e) => e.status === 'done' && e.outBlob);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image Upscaler"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="photo_library" size={16} />}
              onClick={() => void importFromLibrary()}
            >
              From Library
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="upload_file" size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Add images
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={running}
              disabled={queue.length === 0}
              icon={<GIcon name="photo_size_select_large" size={16} />}
              onClick={() => void processAll()}
            >
              Upscale {queue.length > 0 ? `(${queue.length})` : ''}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Target & Output" icon={<GIcon name="aspect_ratio" size={17} />} />

            <div className="space-y-3.5">
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Resolution</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {resolutionTargets.map((t) => {
                    const active = t.id === targetId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTarget(t.id)}
                        className={clsx(
                          'flex items-center gap-2 rounded-[var(--r-control)] border px-2.5 py-2 text-left text-xs transition-colors',
                          active
                            ? 'border-accent bg-accent-soft font-semibold text-accent'
                            : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
                        )}
                      >
                        <GIcon name={t.icon ?? 'hd'} size={16} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Marketplace presets</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {agencyTargets.map((t) => {
                    const active = t.id === targetId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTarget(t.id)}
                        className={clsx(
                          'flex items-center gap-2 rounded-[var(--r-control)] border px-2.5 py-2 text-left text-xs transition-colors',
                          active
                            ? 'border-accent bg-accent-soft font-semibold text-ink'
                            : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
                        )}
                      >
                        {t.platformId && <PlatformLogo id={t.platformId} size={18} />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{t.label}</div>
                          <div className="truncate text-2xs text-ink-muted">{t.badge}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">Format</div>
                  <div className="flex flex-wrap gap-1.5">
                    {UPSCALE_FORMATS.map((fmt) => {
                      const active = outFormat === fmt.id;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setOutFormat(fmt.id)}
                          className={clsx(
                            'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--r-control)] border px-2.5 text-xs font-semibold transition-colors',
                            active
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface text-ink hover:bg-surface-2',
                          )}
                        >
                          <FormatIcon format={fmt.id} size={15} />
                          <span>{fmt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {outFormat !== 'png' && (
                  <Field label={`Quality (${quality}%)`}>
                    <input
                      type="range"
                      min={70}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="mt-2 w-full accent-[var(--accent)]"
                    />
                  </Field>
                )}
              </div>
            </div>
          </Card>


        </div>

        {/* Workspace */}
        <div className="flex min-h-[30rem] min-w-0 flex-col gap-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[18rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/30"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent">
              <GIcon name="add_photo_alternate" size={22} />
            </span>
            <div className="text-sm font-semibold text-ink">Drop images</div>
            <div className="text-xs text-ink-muted">JPG, PNG, WebP, AVIF, BMP and TIFF supported</div>
          </div>

          {queue.length > 0 && (
            <Card>
              <CardHeader
                title={`Queue (${queue.length})`}
                icon={<GIcon name="collections" size={17} />}
                action={
                  <div className="flex items-center gap-2">
                    {doneEntries.length > 1 && (
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<GIcon name="download" size={14} />}
                        onClick={() => {
                          for (const e of doneEntries) {
                            if (e.outBlob && e.outName) triggerBlobDownload(e.outBlob, e.outName);
                          }
                        }}
                      >
                        Download all ({doneEntries.length})
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<GIcon name="delete" size={14} />}
                      onClick={clearQueue}
                    >
                      Clear
                    </Button>
                  </div>
                }
              />

              <div className="divide-y divide-line">
                {queue.map((entry) => {
                  const preview = resolveTargetSize(entry.width, entry.height, activeTarget);
                  return (
                    <div key={entry.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <img
                        src={entry.outUrl ?? entry.srcUrl}
                        alt={entry.name}
                        className="size-13 shrink-0 rounded-[var(--r-xs)] border border-line object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-ink">
                          {entry.outName ?? entry.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted tabular-nums">
                          <span>
                            {entry.width}x{entry.height}
                          </span>
                          <GIcon name="arrow_forward" size={12} />
                          <span className="font-medium text-ink">
                            {entry.outW ?? preview.width}x{entry.outH ?? preview.height}
                          </span>
                          {entry.outMP && <Badge tone="brand">{entry.outMP} MP</Badge>}
                          {entry.outBlob && <span>({formatBytes(entry.outBlob.size)})</span>}
                        </div>
                        {entry.status === 'running' && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                            <div
                              className="h-full rounded-full bg-accent transition-[width]"
                              style={{ width: `${Math.max(8, Math.round(entry.progress * 100))}%` }}
                            />
                          </div>
                        )}
                        {entry.error && (
                          <div className="mt-1 text-2xs font-medium text-danger">{entry.error}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {entry.status === 'done' && entry.outBlob && entry.outName && (
                          <>
                            <Button
                              size="xs"
                              variant="secondary"
                              icon={<GIcon name="photo_library" size={13} />}
                              onClick={async () => {
                                await addGeneratedBlob(entry.outName!, entry.outBlob!);
                                toast.success('Saved to Library', entry.outName);
                              }}
                            >
                              Library
                            </Button>
                            <Button
                              size="xs"
                              variant="primary"
                              icon={<GIcon name="download" size={13} />}
                              onClick={() => triggerBlobDownload(entry.outBlob!, entry.outName!)}
                            >
                              Save
                            </Button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-danger"
                          aria-label="Remove item"
                        >
                          <GIcon name="close" size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-5">
            <CardHeader
              title="Model catalog"
              subtitle="Download once, then upscale offline."
              icon={<GIcon name="memory" size={18} />}
              action={<Badge tone="neutral">{filteredModels.length} models</Badge>}
            />

            <div className="mb-3 flex flex-wrap gap-1">
              {UPSCALE_PURPOSES.map((p) => {
                const active = purpose === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurpose(p.id)}
                    className={clsx(
                      'inline-flex h-7 items-center gap-1 rounded-[var(--r-xs)] border px-2 text-2xs font-medium transition-colors',
                      active
                        ? 'border-accent bg-accent text-on-brand'
                        : 'border-line bg-surface text-ink-muted hover:text-ink',
                    )}
                  >
                    <GIcon name={p.icon} size={13} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
              {filteredModels.map((model) => (
                <ModelTile
                  key={model.id}
                  name={model.name}
                  icon={model.icon}
                  badge={model.scales.map((s) => `${s}x`).join(' / ')}
                  license={model.license}
                  sizeMB={model.sizeMB}
                  selected={modelId === model.id}
                  builtin={model.family === 'builtin'}
                  installed={Boolean(installed[model.id])}
                  desktopOnly={model.family !== 'builtin'}
                  isDesktop={desktop.isDesktop}
                  progress={dlProgress[model.id]}
                  onSelect={() => setModelId(model.id)}
                  onInstall={() => void handleInstallModel(model)}
                  onCancel={() => void cancelModelInstall(model.id)}
                  onUninstall={() => void handleUninstallModel(model)}
                />
              ))}
            </div>
      </Card>
    </div>
  );
}
