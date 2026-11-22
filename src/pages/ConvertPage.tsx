import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Switch } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { FormatIcon } from '@/components/ui/FormatIcon';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { triggerBlobDownload } from '@/lib/desktop';
import { isAndroid } from '@/lib/native/platform';
import { formatBytes } from '@/lib/modelStore';
import {
  ACCEPT_ATTRIBUTE,
  CONVERT_FORMATS,
  CONVERT_RESIZE_PRESETS,
  convertImageFile,
  isSupportedInputExtension,
  type ConvertFormat,
  type ConvertResult,
} from '@/lib/tools/converter';

const BROWSER_DISPLAYABLE = new Set(['jpg', 'png', 'apng', 'webp', 'avif', 'gif', 'svg', 'bmp', 'ico']);

interface ConvertItem {
  id: string;
  name: string;
  srcExt: string;
  blob: Blob;
  srcUrl: string;
  status: 'queued' | 'running' | 'done' | 'error';
  error?: string;
  result?: ConvertResult;
  outUrl?: string;
}

export function ConvertPage() {
  const { items: libItems, getBlob, addGeneratedBlob } = useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<ConvertFormat>('jpg');
  const [quality, setQuality] = useState(92);
  const [background, setBackground] = useState<'transparent' | 'white' | 'black' | 'custom'>('white');
  const [customBg, setCustomBg] = useState('#f5f7fa');
  const [resizePreset, setResizePreset] = useState('original');
  const [customLongEdge, setCustomLongEdge] = useState('3840');
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  // Palette PNG: same .png output, 256 colours, usually far smaller.
  const [palettePng, setPalettePng] = useState(false);

  const [queue, setQueue] = useState<ConvertItem[]>([]);
  const [running, setRunning] = useState(false);
  const [formatSearch, setFormatSearch] = useState('');

  const queueRef = useRef<ConvertItem[]>([]);
  queueRef.current = queue;

  useEffect(() => {
    return () => {
      for (const item of queueRef.current) {
        URL.revokeObjectURL(item.srcUrl);
        if (item.outUrl) URL.revokeObjectURL(item.outUrl);
      }
    };
  }, []);

  // Android: hide vector export formats (moved to dedicated Image to Vector tool).
  const androidFormats = isAndroid()
    ? CONVERT_FORMATS.filter((f) => !['svg', 'svgz', 'eps', 'pdf', 'ai'].includes(f.id))
    : CONVERT_FORMATS;
  const activeFormat = androidFormats.find((f) => f.id === format) ?? androidFormats[0];
  // If the stored format is hidden on Android (vector), reset to a raster default.
  // This runs in an effect — calling setState during render is a React error.
  useEffect(() => {
    if (!androidFormats.some((f) => f.id === format)) {
      setFormat(androidFormats[0].id);
    }
    // androidFormats is a fresh array every render; only re-check when format changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  function selectFormat(next: ConvertFormat) {
    setFormat(next);
    const spec = CONVERT_FORMATS.find((f) => f.id === next);
    if (spec && spec.supportsAlpha && next !== 'jpg') {
      setBackground('transparent');
    } else if (spec && !spec.supportsAlpha && background === 'transparent') {
      setBackground('white');
    }
  }

  function addFiles(list: FileList | File[]) {
    const added: ConvertItem[] = [];
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!file.type.startsWith('image/') && !isSupportedInputExtension(ext)) {
        continue;
      }
      added.push({
        id: `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        srcExt: ext || 'img',
        blob: file,
        srcUrl: URL.createObjectURL(file),
        status: 'queued',
      });
    }
    if (added.length) setQueue((prev) => [...added, ...prev]);
  }

  async function addFromLibrary() {
    const eligible = libItems;
    if (!eligible.length) {
      toast.info('Import images to Library first');
      return;
    }
    const added: ConvertItem[] = [];
    for (const it of eligible.slice(0, 30)) {
      const blob = await getBlob(it.id);
      if (!blob) continue;
      added.push({
        id: `cv_${it.id}_${Date.now().toString(36)}`,
        name: it.name,
        srcExt: it.format,
        blob,
        srcUrl: URL.createObjectURL(blob),
        status: 'queued',
      });
    }
    if (added.length) {
      setQueue((prev) => [...added, ...prev]);
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

  function clearAll() {
    for (const item of queue) {
      URL.revokeObjectURL(item.srcUrl);
      if (item.outUrl) URL.revokeObjectURL(item.outUrl);
    }
    setQueue([]);
  }

  async function runConversion() {
    if (!queue.length || running) return;
    setRunning(true);
    let ok = 0;
    try {
      for (const item of queueRef.current) {
        setQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'running', error: undefined } : i)),
        );
        try {
          const res = await convertImageFile(item.blob, item.name, {
            format,
            quality: quality / 100,
            background,
            customBg,
            resizePreset,
            customLongEdge: Number(customLongEdge) || 3840,
            preserveMetadata,
            palettePng,
          });
          const outUrl = BROWSER_DISPLAYABLE.has(res.format)
            ? URL.createObjectURL(res.blob)
            : item.srcUrl;
          setQueue((prev) =>
            prev.map((i) => {
              if (i.id !== item.id) return i;
              if (i.outUrl && i.outUrl !== i.srcUrl) URL.revokeObjectURL(i.outUrl);
              return { ...i, status: 'done', result: res, outUrl };
            }),
          );
          ok++;
        } catch (error) {
          setQueue((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    result: undefined,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                  }
                : i,
            ),
          );
        }
      }
      if (ok > 0) {
        toast.success(`Converted ${ok} file${ok === 1 ? '' : 's'} to ${activeFormat.label}`);
      }
    } finally {
      setRunning(false);
    }
  }

  const completed = queue.filter((i) => i.status === 'done' && i.result);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Image Converter"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 sm:flex-none"
              icon={<GIcon name="photo_library" size={16} />}
              onClick={() => void addFromLibrary()}
            >
              From Library
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 sm:flex-none"
              icon={<GIcon name="upload_file" size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Add images
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="w-full sm:w-auto"
              loading={running}
              disabled={queue.length === 0}
              icon={<GIcon name="swap_horiz" size={16} />}
              onClick={() => void runConversion()}
            >
              Convert to {activeFormat.label} {queue.length > 0 ? `(${queue.length})` : ''}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title={`Output format (${androidFormats.length})`} icon={<GIcon name="swap_horiz" size={17} />} />
            <div className="mb-2">
              <Input
                value={formatSearch}
                onChange={(e) => setFormatSearch(e.target.value)}
                placeholder="Search formats (png, psd, exr...)"
              />
            </div>
            <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {androidFormats.filter(
                (fmt) =>
                  !formatSearch ||
                  fmt.label.toLowerCase().includes(formatSearch.toLowerCase()) ||
                  fmt.id.includes(formatSearch.toLowerCase()) ||
                  fmt.tag.toLowerCase().includes(formatSearch.toLowerCase()),
              ).map((fmt) => {
                const active = format === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => selectFormat(fmt.id)}
                    className={clsx(
                      'flex items-center gap-2 rounded-[var(--r-control)] border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
                    )}
                  >
                    <FormatIcon format={fmt.id} size={16} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-ink">{fmt.label}</div>
                      <div className="truncate text-2xs text-ink-muted">{fmt.tag}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Conversion options" icon={<GIcon name="tune" size={17} />} />
            <div className="space-y-3.5">
              {activeFormat.lossy && (
                <Field label={`Quality (${quality}%)`}>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
              )}

              {activeFormat.id === 'png' && (
                <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-ink-muted">
                  <input
                    type="checkbox"
                    checked={palettePng}
                    onChange={(e) => setPalettePng(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Palette PNG (256 colours, much smaller)
                </label>
              )}

              <Field label="Resize">
                <Select
                  value={resizePreset}
                  onChange={(e) => setResizePreset(e.target.value)}
                  options={CONVERT_RESIZE_PRESETS.map((r) => ({ value: r.id, label: r.label }))}
                />
              </Field>

              {resizePreset === 'custom' && (
                <Field label="Long edge (pixels)">
                  <Input
                    type="number"
                    min={16}
                    max={12000}
                    value={customLongEdge}
                    onChange={(e) => setCustomLongEdge(e.target.value)}
                  />
                </Field>
              )}

              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Background fill</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'transparent', label: 'Alpha', disabled: !activeFormat.supportsAlpha },
                      { id: 'white', label: 'White', disabled: false },
                      { id: 'black', label: 'Black', disabled: false },
                      { id: 'custom', label: 'Color', disabled: false },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => setBackground(opt.id)}
                      className={clsx(
                        'h-8 rounded-[var(--r-control)] border text-xs font-medium disabled:opacity-40',
                        background === opt.id
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface text-ink-muted hover:text-ink',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {background === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={customBg}
                      onChange={(e) => setCustomBg(e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-[var(--r-xs)] border border-line bg-surface"
                    />
                    <Input value={customBg} onChange={(e) => setCustomBg(e.target.value)} />
                  </div>
                )}
              </div>

              {activeFormat.supportsXmp && (
                <Switch
                  checked={preserveMetadata}
                  onChange={setPreserveMetadata}
                  label="Keep supported embedded XMP metadata"
                />
              )}
            </div>
          </Card>
        </div>

        <div className="flex min-h-[30rem] min-w-0 flex-col gap-4 lg:sticky lg:top-[4.75rem] lg:self-start">
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
              <GIcon name="swap_horiz" size={22} />
            </span>
            <div className="text-sm font-semibold text-ink">Drop images</div>
            <div className="text-xs text-ink-muted">
              JPG, PNG, WebP, AVIF, HEIC, RAW, PSD, PDF
            </div>
          </div>

          {queue.length > 0 && (
            <Card>
              <CardHeader
                title={`Files (${queue.length})`}
                icon={<GIcon name="collections" size={17} />}
                action={
                  <div className="flex items-center gap-2">
                    {completed.length > 0 && (
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<GIcon name="download" size={14} />}
                        onClick={() => {
                          for (const c of completed) {
                            if (c.result) triggerBlobDownload(c.result.blob, c.result.filename);
                          }
                        }}
                      >
                        Download all ({completed.length})
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<GIcon name="delete" size={14} />}
                      onClick={clearAll}
                    >
                      Clear
                    </Button>
                  </div>
                }
              />

              <div className="divide-y divide-line">
                {queue.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="checkerboard size-12 shrink-0 overflow-hidden rounded-[var(--r-xs)] border border-line">
                      <img
                        src={item.outUrl ?? item.srcUrl}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-ink">
                        {item.result?.filename ?? item.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted tabular-nums">
                        <Badge tone="neutral">{item.srcExt.toUpperCase()}</Badge>
                        <GIcon name="arrow_forward" size={12} />
                        <Badge tone="brand">{(item.result?.format ?? format).toUpperCase()}</Badge>
                        <span>{formatBytes(item.blob.size)}</span>
                        {item.result && (
                          <>
                            <GIcon name="arrow_forward" size={12} />
                            <span className="font-medium text-ink">
                              {formatBytes(item.result.sizeBytes)} ({item.result.width}x{item.result.height})
                            </span>
                          </>
                        )}
                        {item.result?.preservedXmp && <Badge tone="brand">XMP kept</Badge>}
                      </div>
                      {item.error && (
                        <div className="mt-1 text-2xs font-medium text-danger">{item.error}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.result && (
                        <>
                          <Button
                            size="xs"
                            variant="secondary"
                            icon={<GIcon name="photo_library" size={13} />}
                            onClick={async () => {
                              await addGeneratedBlob(item.result!.filename, item.result!.blob);
                              toast.success('Saved to Library', item.result!.filename);
                            }}
                          >
                            Library
                          </Button>
                          <Button
                            size="xs"
                            variant="primary"
                            icon={<GIcon name="download" size={13} />}
                            onClick={() => triggerBlobDownload(item.result!.blob, item.result!.filename)}
                          >
                            Save
                          </Button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-danger"
                        aria-label="Remove file"
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
    </div>
  );
}
