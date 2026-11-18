import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { MaskEditor } from '@/components/tools/MaskEditor';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { ModelTile } from '@/components/ui/ModelTile';
import { GIcon } from '@/components/ui/GoogleIcon';
import { FormatIcon } from '@/components/ui/FormatIcon';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { useLicense } from '@/state/LicenseState';
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
  BG_MODELS,
  BG_PURPOSES,
  buildBgInstallSpec,
  removeImageBackground,
  type BgModel,
  type BgPurpose,
  type BgRemoveResult,
} from '@/lib/tools/bgremove';

interface CutoutEntry {
  id: string;
  name: string;
  blob: Blob;
  srcUrl: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  label?: string;
  error?: string;
  result?: BgRemoveResult;
  outUrl?: string;
}

export function BgRemovePage() {
  const { items: libItems, getBlob, addGeneratedBlob } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const { premium: hasPlan } = useLicense();
  const fileRef = useRef<HTMLInputElement>(null);

  const [purpose, setPurpose] = useState<BgPurpose>('all');
  const [modelId, setModelId] = useState<string>('studio-cutout');
  const [outFormat, setOutFormat] = useState<'png' | 'webp' | 'jpg'>('png');
  const [backdrop, setBackdrop] = useState<'transparent' | 'white' | 'black' | 'custom'>('transparent');
  const [customColor, setCustomColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(34);
  const [feather, setFeather] = useState(1);

  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [dlProgress, setDlProgress] = useState<Record<string, ModelProgressEvent>>({});
  const [queue, setQueue] = useState<CutoutEntry[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [splitPos, setSplitPos] = useState(50);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const queueRef = useRef<CutoutEntry[]>([]);
  queueRef.current = queue;

  useEffect(() => {
    void listInstalledModels().then((map) => {
      const next: Record<string, boolean> = {};
      for (const id of Object.keys(map)) next[id] = true;
      setInstalled(next);
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
      for (const item of queueRef.current) {
        URL.revokeObjectURL(item.srcUrl);
        if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      }
    };
  }, []);

  const filteredModels = useMemo(
    () => (purpose === 'all' ? BG_MODELS : BG_MODELS.filter((m) => m.purposes.includes(purpose))),
    [purpose],
  );
  const activeModel = BG_MODELS.find((m) => m.id === modelId) ?? BG_MODELS[0];

  async function handleInstall(model: BgModel) {
    const spec = buildBgInstallSpec(model);
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
      toast.error('Model download failed', res.error);
    }
  }

  async function handleUninstall(model: BgModel) {
    await uninstallModelInApp(model.id);
    setInstalled((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    if (modelId === model.id) setModelId('studio-cutout');
    toast.info(`${model.name} removed`);
  }

  function addFiles(list: FileList | File[]) {
    const added: CutoutEntry[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) continue;
      added.push({
        id: `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        blob: file,
        srcUrl: URL.createObjectURL(file),
        status: 'queued',
        progress: 0,
      });
    }
    if (added.length) {
      setQueue((prev) => [...added, ...prev]);
      setActivePreviewId(added[0].id);
    }
  }

  async function addFromLibrary() {
    const rasters = libItems.filter((it) => it.format !== 'eps' && it.format !== 'ai' && it.format !== 'svg');
    if (!rasters.length) {
      toast.info('Import images to Library first');
      return;
    }
    const added: CutoutEntry[] = [];
    for (const it of rasters.slice(0, 20)) {
      const blob = await getBlob(it.id);
      if (!blob) continue;
      added.push({
        id: `bg_${it.id}_${Date.now().toString(36)}`,
        name: it.name,
        blob,
        srcUrl: URL.createObjectURL(blob),
        status: 'queued',
        progress: 0,
      });
    }
    if (added.length) {
      setQueue((prev) => [...added, ...prev]);
      setActivePreviewId(added[0].id);
      toast.success(`Added ${added.length} from Library`);
    }
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const hit = prev.find((i) => i.id === id);
      if (hit) {
        URL.revokeObjectURL(hit.srcUrl);
        if (hit.outUrl) URL.revokeObjectURL(hit.outUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearQueue() {
    for (const item of queue) {
      URL.revokeObjectURL(item.srcUrl);
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
    }
    setQueue([]);
    setActivePreviewId(null);
  }

  async function processQueue() {
    if (!queue.length || running) return;
    setRunning(true);
    let ok = 0;
    try {
      for (const entry of queueRef.current) {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === entry.id ? { ...i, status: 'running', progress: 0.08, error: undefined } : i,
          ),
        );
        try {
          const res = await removeImageBackground(entry.blob, entry.name, {
            modelId,
            outFormat,
            backdrop: outFormat === 'jpg' && backdrop === 'transparent' ? 'white' : backdrop,
            customColor,
            tolerance,
            feather,
            quality: 0.95,
            onProgress: (ratio, label) => {
              setQueue((prev) =>
                prev.map((i) => (i.id === entry.id ? { ...i, progress: ratio, label } : i)),
              );
            },
          });
          const outUrl = URL.createObjectURL(res.blob);
          setQueue((prev) =>
            prev.map((i) => {
              if (i.id !== entry.id) return i;
              if (i.outUrl) URL.revokeObjectURL(i.outUrl);
              return { ...i, status: 'done', progress: 1, result: res, outUrl };
            }),
          );
          setActivePreviewId(entry.id);
          ok++;
        } catch (error) {
          setQueue((prev) =>
            prev.map((i) =>
              i.id === entry.id
                ? {
                    ...i,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                  }
                : i,
            ),
          );
        }
      }
      if (ok > 0) {
        toast.success(`Background removed on ${ok} image${ok === 1 ? '' : 's'}`);
      }
    } finally {
      setRunning(false);
    }
  }

  const previewItem = queue.find((i) => i.id === activePreviewId) ?? queue[0];
  const editingItem = queue.find((i) => i.id === editingId);
  const doneItems = queue.filter((i) => i.status === 'done' && i.result);

  return (
    <div className="space-y-5">
      {editingItem?.result && (
        <MaskEditor key={editingItem.id} source={editingItem.blob} result={editingItem.result} onClose={() => setEditingId(null)} onSave={(result) => {
          const url = URL.createObjectURL(result.blob);
          setQueue((prev) => prev.map((item) => {
            if (item.id !== editingItem.id) return item;
            if (item.outUrl) URL.revokeObjectURL(item.outUrl);
            return { ...item, result, outUrl: url };
          }));
          setEditingId(null);
          toast.success('Cutout updated', 'Saved as a transparent PNG.');
        }} />
      )}
      <PageHeader
        title="Background Remover"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="photo_library" size={16} />}
              onClick={() => void addFromLibrary()}
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
              icon={<GIcon name="content_cut" size={16} />}
              onClick={() => void processQueue()}
            >
              Remove background {queue.length > 0 ? `(${queue.length})` : ''}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Cutout settings" icon={<GIcon name="tune" size={17} />} />
            <div className="space-y-3.5">
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Backdrop</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'transparent', label: 'Transparent', icon: 'grid_view' as const },
                      { id: 'white', label: 'Stock White', icon: 'light_mode' as const },
                      { id: 'black', label: 'Studio Dark', icon: 'dark_mode' as const },
                      { id: 'custom', label: 'Custom', icon: 'palette' as const },
                    ] as const
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => {
                        setBackdrop(bg.id);
                        if (bg.id === 'transparent' && outFormat === 'jpg') setOutFormat('png');
                      }}
                      className={clsx(
                        'flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--r-control)] border px-2 py-1.5 text-2xs font-semibold',
                        backdrop === bg.id
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface text-ink-muted hover:text-ink',
                      )}
                    >
                      <GIcon name={bg.icon} size={13} />
                      <span className="leading-tight">{bg.label}</span>
                    </button>
                  ))}
                </div>
                {backdrop === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-[var(--r-xs)] border border-line bg-surface"
                    />
                    <Input value={customColor} onChange={(e) => setCustomColor(e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Output format</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['png', 'webp', 'jpg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setOutFormat(fmt);
                        if (fmt === 'jpg' && backdrop === 'transparent') setBackdrop('white');
                      }}
                      className={clsx(
                        'flex h-9 items-center justify-center gap-1.5 rounded-[var(--r-control)] border text-xs font-semibold',
                        outFormat === fmt
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      <FormatIcon format={fmt} size={15} />
                      <span>{fmt.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeModel.kind === 'builtin' && (
                  <Field label={`Sensitivity (${tolerance})`}>
                    <input
                      type="range"
                      min={12}
                      max={85}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                  </Field>
                )}
                <Field label={`Edge feather (${feather} px)`}>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={feather}
                    onChange={(e) => setFeather(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-h-[30rem] min-w-0 flex-col gap-4">
          {previewItem?.outUrl ? (
            <Card>
              <CardHeader
                title="Before & After"
                icon={<GIcon name="compare" size={17} />}
                action={
                  <div className="flex items-center gap-2 text-2xs text-ink-muted">
                    <Button size="xs" variant="secondary" disabled={running} onClick={() => setEditingId(previewItem.id)}>Edit mask</Button>
                    <label htmlFor="bg-split">Split</label>
                    <input id="bg-split"
                      type="range"
                      min={0}
                      max={100}
                      value={splitPos}
                      onChange={(e) => setSplitPos(Number(e.target.value))}
                      className="w-28 accent-[var(--accent)]"
                    />
                  </div>
                }
              />
              <div className="checkerboard relative flex max-h-[380px] min-h-[240px] items-center justify-center overflow-hidden rounded-[var(--r-control)] border border-line">
                <img
                  src={previewItem.outUrl}
                  alt="Cutout result"
                  className="max-h-[380px] w-full object-contain"
                />
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-2"
                  style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                >
                  <img
                    src={previewItem.srcUrl}
                    alt="Original"
                    className="max-h-[380px] w-full object-contain"
                  />
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent"
                  style={{ left: `${splitPos}%` }}
                />
              </div>
            </Card>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[18rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/30"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent">
                <GIcon name="content_cut" size={22} />
              </span>
              <div className="text-sm font-semibold text-ink">Drop images</div>
              <div className="text-xs text-ink-muted">
                Export transparent PNG, WebP or pure white stock JPG cutouts
              </div>
            </div>
          )}

          {queue.length > 0 && (
            <Card>
              <CardHeader
                title={`Cutout queue (${queue.length})`}
                icon={<GIcon name="collections" size={17} />}
                action={
                  <div className="flex items-center gap-2">
                    {doneItems.length > 1 && (
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<GIcon name="download" size={14} />}
                        onClick={() => {
                          for (const d of doneItems) {
                            if (d.result) triggerBlobDownload(d.result.blob, d.result.filename);
                          }
                        }}
                      >
                        Download all ({doneItems.length})
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
                {queue.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setActivePreviewId(entry.id)}
                      className="checkerboard size-12 shrink-0 overflow-hidden rounded-[var(--r-xs)] border border-line"
                    >
                      <img
                        src={entry.outUrl ?? entry.srcUrl}
                        alt={entry.name}
                        className="size-full object-cover"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-ink">
                        {entry.result?.filename ?? entry.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted tabular-nums">
                        {entry.result ? (
                          <>
                            <span>
                              {entry.result.width}x{entry.result.height}
                            </span>
                            <span>·</span>
                            <span>{formatBytes(entry.result.sizeBytes)}</span>
                            <Badge tone="brand">Cutout ready</Badge>
                          </>
                        ) : (
                          <span>{entry.label || formatBytes(entry.blob.size)}</span>
                        )}
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
                      {entry.result && (
                        <>
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={<GIcon name="photo_library" size={13} />}
                            onClick={async () => {
                              await addGeneratedBlob(entry.result!.filename, entry.result!.blob);
                              toast.success('Saved to Library', entry.result!.filename);
                            }}
                          >
                            Library
                          </Button>
                          <Button
                            size="xs"
                            variant="primary"
                            icon={<GIcon name="download" size={13} />}
                            onClick={() => triggerBlobDownload(entry.result!.blob, entry.result!.filename)}
                          >
                            Save
                          </Button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(entry.id)}
                        className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-danger"
                        aria-label="Remove item"
                      >
                        <GIcon name="close" size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-5">
            <CardHeader
              title="Background removal models"
              icon={<GIcon name="memory" size={17} />}
              action={<Badge tone="neutral">{filteredModels.length}</Badge>}
            />
            <div className="mb-3 flex flex-wrap gap-1">
              {BG_PURPOSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurpose(p.id)}
                  className={clsx(
                    'inline-flex h-7 items-center gap-1 rounded-[var(--r-xs)] border px-2 text-2xs font-medium',
                    purpose === p.id
                      ? 'border-accent bg-accent text-on-brand'
                      : 'border-line bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  <GIcon name={p.icon} size={13} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
              {filteredModels.map((model) => (
                <ModelTile
                  key={model.id}
                  name={model.name}
                  icon={model.icon}
                  badge={`${model.inputSize} px`}
                  license={model.license}
                  sizeMB={model.sizeMB}
                  selected={modelId === model.id}
                  locked={Boolean(model.premium) && !hasPlan}
                  builtin={model.kind === 'builtin'}
                  installed={Boolean(installed[model.id])}
                  isDesktop={desktop.isDesktop}
                  progress={dlProgress[model.id]}
                  onSelect={() => {
                    if (model.premium && !hasPlan) {
                      toast.info('Premium model', 'Included with any plan. It uses no credits.');
                      navigate('/subscription');
                      return;
                    }
                    setModelId(model.id);
                  }}
                  onInstall={() => void handleInstall(model)}
                  onCancel={() => void cancelModelInstall(model.id)}
                  onUninstall={() => void handleUninstall(model)}
                />
              ))}
            </div>
      </Card>
    </div>
  );
}
