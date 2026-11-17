import { useCallback, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { useLibrary } from '@/state/library';
import { triggerBlobDownload } from '@/lib/desktop';
import { decodeRaster, encodeRaster } from '@/lib/tools/converter';
import {
  DEFAULT_QUALITY,
  optimizeRaster,
  type OptimizeFormat,
} from '@/lib/tools/optimizer';

type Mode = 'auto' | 'target' | 'quality';

interface Item {
  id: string;
  name: string;
  before: number;
  width: number;
  height: number;
  srcUrl: string;
  status: 'queued' | 'running' | 'done' | 'error';
  after?: number;
  outUrl?: string;
  outName?: string;
  quality?: number;
  outWidth?: number;
  outHeight?: number;
  error?: string;
}

const FORMAT_OPTIONS: Array<{ id: 'keep' | OptimizeFormat; label: string }> = [
  { id: 'keep', label: 'Keep original' },
  { id: 'jpg', label: 'JPEG' },
  { id: 'webp', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'png', label: 'PNG (lossless)' },
];

const EDGE_OPTIONS = [
  { id: '0', label: 'Original size' },
  { id: '4000', label: '4000 px long edge' },
  { id: '3000', label: '3000 px long edge' },
  { id: '2000', label: '2000 px long edge' },
];

const MIME: Record<OptimizeFormat, string> = {
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
};

const extensionOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

function replaceExtension(name: string, ext: string) {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}-optimized.${ext}`;
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function OptimizePage() {
  const toast = useToast();
  const { items: libraryItems, getBlob } = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const [format, setFormat] = useState<'keep' | OptimizeFormat>('keep');
  const [mode, setMode] = useState<Mode>('auto');
  const [targetKB, setTargetKB] = useState('2500');
  const [quality, setQuality] = useState('86');
  const [longEdge, setLongEdge] = useState('0');
  const [stripMetadata, setStripMetadata] = useState(true);
  const [running, setRunning] = useState(false);

  const totals = useMemo(() => {
    const done = queue.filter((q) => q.status === 'done' && q.after !== undefined);
    const before = done.reduce((sum, q) => sum + q.before, 0);
    const after = done.reduce((sum, q) => sum + (q.after ?? 0), 0);
    return {
      done: done.length,
      before,
      after,
      saved: Math.max(0, before - after),
      percent: before > 0 ? Math.round(((before - after) / before) * 100) : 0,
    };
  }, [queue]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|bmp|tiff?)$/i.test(f.name));
      if (!list.length) return;
      const added: Item[] = [];
      for (const file of list) {
        const srcUrl = URL.createObjectURL(file);
        let width = 0;
        let height = 0;
        try {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close?.();
        } catch {
          /* dimensions filled in during processing */
        }
        added.push({
          id: `op_${file.name}_${file.size}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          before: file.size,
          width,
          height,
          srcUrl,
          status: 'queued',
        });
      }
      setQueue((prev) => [...added, ...prev]);
    },
    [],
  );

  const addFromLibrary = useCallback(async () => {
    const eligible = libraryItems.filter((i) => ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff'].includes(i.format));
    if (!eligible.length) {
      toast.info('Import images to the Library first');
      return;
    }
    const added: Item[] = [];
    for (const entry of eligible.slice(0, 20)) {
      const blob = await getBlob(entry.id);
      if (!blob) continue;
      added.push({
        id: `op_lib_${entry.id}`,
        name: entry.name,
        before: blob.size,
        width: entry.width ?? 0,
        height: entry.height ?? 0,
        srcUrl: URL.createObjectURL(blob),
        status: 'queued',
      });
    }
    if (added.length) {
      setQueue((prev) => [...added, ...prev]);
      toast.success(`Added ${added.length} from Library`);
    }
  }, [libraryItems, getBlob, toast]);

  const run = useCallback(async () => {
    if (running || !queue.length) return;
    setRunning(true);
    const pending = queue.filter((q) => q.status !== 'done');
    for (const item of pending) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: 'running' } : q)));
      try {
        const source = await (async () => {
          const candidate = await fetch(item.srcUrl).then((r) => r.blob());
          return candidate;
        })();
        const bytes = new Uint8Array(await source.arrayBuffer());
        const raster = await decodeRaster(bytes, item.name);
        const sourceFormat = extensionOf(item.name) === 'jpeg' ? 'jpg' : extensionOf(item.name);
        const targetFormat: OptimizeFormat =
          format === 'keep'
            ? sourceFormat === 'jpg' || sourceFormat === 'webp' || sourceFormat === 'avif' || sourceFormat === 'png'
              ? (sourceFormat as OptimizeFormat)
              : 'jpg'
            : format;

        const maxLongEdge = Number(longEdge) || 0;
        let result = await optimizeRaster(
          raster,
          {
            format: targetFormat,
            targetKB: mode === 'target' ? Number(targetKB) || undefined : undefined,
            quality: mode === 'quality' ? Number(quality) / 100 : DEFAULT_QUALITY[targetFormat],
            maxLongEdge,
            qualityFloor: 0.45,
          },
          (r, q) => encodeRaster({ width: r.width, height: r.height, data: r.data } as never, targetFormat, q),
        );

        // If the first pass grew the file, try a lower quality before giving up.
        if (
          mode !== 'target' &&
          result.bytes.byteLength >= item.before &&
          targetFormat === sourceFormat &&
          !result.resized
        ) {
          const retry = await optimizeRaster(
            raster,
            { format: targetFormat, quality: 0.7, maxLongEdge, qualityFloor: 0.5 },
            (r, q) => encodeRaster({ width: r.width, height: r.height, data: r.data } as never, targetFormat, q),
          );
          if (retry.bytes.byteLength < result.bytes.byteLength) result = retry;
        }

        // Never hand back something larger than the original.
        if (result.bytes.byteLength >= item.before && targetFormat === sourceFormat && !result.resized) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'done',
                    after: item.before,
                    outUrl: item.srcUrl,
                    outName: item.name,
                    quality: 1,
                    outWidth: raster.width,
                    outHeight: raster.height,
                  }
                : q,
            ),
          );
          continue;
        }

        const blob = new Blob([new Uint8Array(result.bytes)], { type: MIME[targetFormat] });
        const outUrl = URL.createObjectURL(blob);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'done',
                  after: result.bytes.byteLength,
                  outUrl,
                  outName: replaceExtension(item.name, targetFormat === 'jpg' ? 'jpg' : targetFormat),
                  quality: result.quality,
                  outWidth: result.width,
                  outHeight: result.height,
                }
              : q,
          ),
        );
      } catch (e) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', error: e instanceof Error ? e.message : 'Could not optimise this file.' }
              : q,
          ),
        );
      }
    }
    setRunning(false);
  }, [queue, running, format, mode, targetKB, quality, longEdge]);

  const downloadAll = () => {
    for (const item of queue) {
      if (item.status !== 'done' || !item.outUrl || !item.outName) continue;
      void fetch(item.outUrl)
        .then((r) => r.blob())
        .then((blob) => triggerBlobDownload(blob, item.outName!));
    }
    toast.success('Optimized files downloaded');
  };

  const clearAll = () => {
    for (const item of queue) {
      URL.revokeObjectURL(item.srcUrl);
      if (item.outUrl && item.outUrl !== item.srcUrl) URL.revokeObjectURL(item.outUrl);
    }
    setQueue([]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image Optimizer"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<GIcon name="photo_library" size={16} />} onClick={() => void addFromLibrary()}>
              From Library
            </Button>
            <Button size="sm" icon={<GIcon name="add" size={16} />} onClick={() => fileRef.current?.click()}>
              Add images
            </Button>
          </div>
        }
      />

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

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <Card padding="md" className="space-y-4 lg:sticky lg:top-[4.75rem] lg:self-start">
          <Field label="Output format">
            <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Size control">
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'target', label: 'Target KB' },
                  { id: 'quality', label: 'Quality' },
                ] as Array<{ id: Mode; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={clsx(
                    'h-8 rounded-[var(--r-control)] border text-[0.75rem] font-medium transition-colors',
                    mode === option.id
                      ? 'border-brand bg-brand-soft text-brand-fg'
                      : 'border-line bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {mode === 'target' && (
              <Input
                type="number"
                min={50}
                value={targetKB}
                onChange={(e) => setTargetKB(e.target.value)}
                trailing={<span className="text-[0.75rem] text-ink-faint">KB</span>}
              />
            )}
            {mode === 'quality' && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="flex-1 accent-[var(--brand)]"
                />
                <span className="w-9 text-right text-[0.8125rem] font-semibold tabular-nums text-ink">{quality}</span>
              </div>
            )}
            {mode === 'auto' && (
              <p className="mt-1.5 text-[0.75rem] text-ink-muted">
                Visually lossless.
              </p>
            )}
          </Field>

          <Field label="Resize">
            <Select value={longEdge} onChange={(e) => setLongEdge(e.target.value)}>
              {EDGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-ink-muted">
            <input
              type="checkbox"
              checked={stripMetadata}
              onChange={(e) => setStripMetadata(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Strip camera metadata
          </label>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={() => void run()} disabled={!queue.length || running} icon={<GIcon name="play_arrow" size={16} />}>
              {running ? 'Optimizing…' : 'Optimize'}
            </Button>
            {queue.length > 0 && (
              <Button variant="ghost" onClick={clearAll} aria-label="Clear queue">
                <GIcon name="delete" size={16} />
              </Button>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-3">
          {queue.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[22rem] cursor-pointer flex-col items-center justify-center gap-3.5 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 py-12 text-center transition-colors hover:border-brand hover:bg-brand-soft/30"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-[var(--r-card)] bg-brand-soft text-brand">
                <GIcon name="compress" size={26} />
              </span>
              <div>
                <div className="text-[0.9375rem] font-semibold text-ink">Drop images</div>
                <div className="mt-1 text-[0.8125rem] text-ink-muted">JPG, PNG, WebP, AVIF</div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand" icon={<GIcon name="compress" size={13} />}>
                  {totals.percent}% smaller
                </Badge>
                <span className="text-[0.8125rem] text-ink-muted">
                  {formatBytes(totals.before)} → {formatBytes(totals.after)}
                  {totals.done > 0 && ` · ${totals.done} of ${queue.length} done`}
                </span>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<GIcon name="download" size={16} />}
                    onClick={downloadAll}
                    disabled={totals.done === 0}
                  >
                    Download
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-line overflow-hidden rounded-[var(--r-card)] border border-line bg-surface">
                {queue.map((item) => {
                  const saved = item.after !== undefined ? item.before - item.after : 0;
                  const percent = item.after !== undefined && item.before > 0 ? Math.round((saved / item.before) * 100) : 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="checkerboard size-11 shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-line">
                        <img src={item.srcUrl} alt="" className="size-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.8125rem] font-semibold text-ink">{item.outName ?? item.name}</div>
                        <div className="text-[0.75rem] text-ink-muted tabular-nums">
                          {item.status === 'running' && 'Optimizing…'}
                          {item.status === 'queued' && `${formatBytes(item.before)} · queued`}
                          {item.status === 'error' && (item.error ?? 'Failed')}
                          {item.status === 'done' && item.after !== undefined && (
                            <>
                              {formatBytes(item.before)} → {formatBytes(item.after)}
                              {item.outWidth ? ` · ${item.outWidth}×${item.outHeight}` : ''}
                              {item.quality !== undefined && item.quality < 1 ? ` · q${Math.round(item.quality * 100)}` : ''}
                            </>
                          )}
                        </div>
                      </div>
                      {item.status === 'done' && item.after !== undefined && (
                        <Badge tone={percent > 0 ? 'ok' : 'neutral'} size="sm">
                          {percent > 0 ? `-${percent}%` : 'already tight'}
                        </Badge>
                      )}
                      {item.status === 'done' && item.outUrl && item.outName && (
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label="Download"
                          onClick={() =>
                            void fetch(item.outUrl!)
                              .then((r) => r.blob())
                              .then((blob) => triggerBlobDownload(blob, item.outName!))
                          }
                        >
                          <GIcon name="download" size={15} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
