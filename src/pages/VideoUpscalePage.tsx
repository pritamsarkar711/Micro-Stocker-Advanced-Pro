import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Switch } from '@/components/ui/Field';
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
  buildVideoInstallSpec,
  extractUpscaledVideoFrame,
  formatDuration,
  probeVideoFile,
  resolveVideoDimensions,
  upscaleVideoInApp,
  VIDEO_MODELS,
  VIDEO_OUTPUT_FORMATS,
  VIDEO_PURPOSES,
  VIDEO_TARGETS,
  type UpscaleVideoResult,
  type VideoMeta,
  type VideoModel,
  type VideoPurpose,
} from '@/lib/tools/videoupscale';

interface VideoJob {
  id: string;
  name: string;
  blob: Blob;
  srcUrl: string;
  meta: VideoMeta;
  status: 'ready' | 'running' | 'done' | 'error';
  progress: number;
  statusText?: string;
  error?: string;
  result?: UpscaleVideoResult;
  outUrl?: string;
}

export function VideoUpscalePage() {
  const { addGeneratedBlob } = useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [purpose, setPurpose] = useState<VideoPurpose>('all');
  const [modelId, setModelId] = useState<string>('fsr-easu-rcas');
  const [targetId, setTargetId] = useState<string>('4k');
  const [outFormat, setOutFormat] = useState<'mp4' | 'webm'>('mp4');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [bitrateMbps, setBitrateMbps] = useState(20);
  const [keepAudio, setKeepAudio] = useState(true);

  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [dlProgress, setDlProgress] = useState<Record<string, ModelProgressEvent>>({});
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const jobsRef = useRef<VideoJob[]>([]);
  jobsRef.current = jobs;

  useEffect(() => {
    void listInstalledModels().then((map) => {
      const next: Record<string, boolean> = {};
      for (const id of Object.keys(map)) next[id] = true;
      setInstalled(next);
    });
    return onModelProgress((ev) => {
      setDlProgress((prev) => ({ ...prev, [ev.id]: ev }));
      if (ev.phase === 'ready') setInstalled((prev) => ({ ...prev, [ev.id]: true }));
    });
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const j of jobsRef.current) {
        URL.revokeObjectURL(j.srcUrl);
        if (j.outUrl) URL.revokeObjectURL(j.outUrl);
      }
    };
  }, []);

  const filteredModels = useMemo(
    () =>
      VIDEO_MODELS.filter((m) => m.runtime === 'builtin' && (purpose === 'all' || m.purposes.includes(purpose))),
    [purpose],
  );
  const activeModel = VIDEO_MODELS.find((m) => m.id === modelId) ?? VIDEO_MODELS[0];
  const activeTarget = VIDEO_TARGETS.find((t) => t.id === targetId) ?? VIDEO_TARGETS[0];
  const activeJob = jobs.find((j) => j.id === activeId) ?? jobs[0];

  function selectTarget(id: string) {
    setTargetId(id);
    const t = VIDEO_TARGETS.find((x) => x.id === id);
    if (t?.defaultFps) setFps(t.defaultFps);
  }

  function selectModel(model: VideoModel) {
    setModelId(model.id);
    if (model.fpsMultiplier === 2) setFps(60);
  }

  async function handleInstall(model: VideoModel) {
    const spec = buildVideoInstallSpec(model);
    if (!spec) return;
    const res = await installModelInApp(spec);
    setDlProgress((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    if (res.ok) {
      setInstalled((prev) => ({ ...prev, [model.id]: true }));
      selectModel(model);
      toast.success(`${model.name} installed`);
    } else if (!res.canceled) {
      toast.error('Install failed', res.error);
    }
  }

  async function handleUninstall(model: VideoModel) {
    await uninstallModelInApp(model.id);
    setInstalled((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    if (modelId === model.id) setModelId('fsr-easu-rcas');
    toast.info(`${model.name} removed`);
  }

  async function addVideos(list: FileList | File[]) {
    const added: VideoJob[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name)) {
        continue;
      }
      try {
        const meta = await probeVideoFile(file);
        added.push({
          id: `vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          blob: file,
          srcUrl: URL.createObjectURL(file),
          meta,
          status: 'ready',
          progress: 0,
        });
      } catch (err) {
        toast.error(`Skipped ${file.name}`, err instanceof Error ? err.message : String(err));
      }
    }
    if (added.length) {
      setJobs((prev) => [...added, ...prev]);
      setActiveId(added[0].id);
    }
  }

  function removeJob(id: string) {
    setJobs((prev) => {
      const hit = prev.find((j) => j.id === id);
      if (hit) {
        URL.revokeObjectURL(hit.srcUrl);
        if (hit.outUrl) URL.revokeObjectURL(hit.outUrl);
      }
      return prev.filter((j) => j.id !== id);
    });
  }

  async function runAll() {
    if (!jobs.length || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    let ok = 0;

    try {
      for (const job of jobsRef.current) {
        if (controller.signal.aborted) break;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: 'running', progress: 0.02, error: undefined } : j,
          ),
        );
        try {
          const res = await upscaleVideoInApp(job.blob, job.name, job.meta, {
            modelId,
            target: activeTarget,
            fps,
            format: outFormat,
            bitrateMbps,
            keepAudio,
            signal: controller.signal,
            onProgress: (ratio, statusText) => {
              setJobs((prev) =>
                prev.map((j) => (j.id === job.id ? { ...j, progress: ratio, statusText } : j)),
              );
            },
          });
          const outUrl = URL.createObjectURL(res.blob);
          setJobs((prev) =>
            prev.map((j) => {
              if (j.id !== job.id) return j;
              if (j.outUrl) URL.revokeObjectURL(j.outUrl);
              return { ...j, status: 'done', progress: 1, result: res, outUrl };
            }),
          );
          setActiveId(job.id);
          ok++;
        } catch (err) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: 'error',
                    error: err instanceof Error ? err.message : String(err),
                  }
                : j,
            ),
          );
        }
      }
      if (ok > 0) {
        toast.success(`Upscaled ${ok} video${ok === 1 ? '' : 's'}`, activeTarget.label);
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  async function captureFrameToLibrary() {
    const video = playerRef.current;
    if (!video || !activeJob) return;
    try {
      const captured = await extractUpscaledVideoFrame(video, activeTarget, activeModel, 'jpg');
      const stem = activeJob.name.replace(/\.[^.]+$/, '').replace(/[-–—\s]+/g, '_');
      const frameName = `${stem}_${activeTarget.id}_frame.jpg`;
      await addGeneratedBlob(frameName, captured.blob);
      toast.success('Upscaled frame saved to Library', `${captured.width}x${captured.height}`);
    } catch (err) {
      toast.error('Frame capture failed', err instanceof Error ? err.message : String(err));
    }
  }

  const resTargets = VIDEO_TARGETS.filter((t) => t.group === 'resolution');
  const stockTargets = VIDEO_TARGETS.filter((t) => t.group === 'platform');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Video Upscaler"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="video/*,.mp4,.mov,.webm,.mkv,.m4v"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addVideos(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="video_file" size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Add videos
            </Button>
            {running ? (
              <Button
                size="sm"
                variant="danger"
                icon={<GIcon name="stop" size={16} />}
                onClick={() => abortRef.current?.abort()}
              >
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={jobs.length === 0}
                icon={<GIcon name="videocam" size={16} />}
                onClick={() => void runAll()}
              >
                Upscale video {jobs.length > 0 ? `(${jobs.length})` : ''}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Resolution & Codec" icon={<GIcon name="theaters" size={17} />} />

            <div className="space-y-3.5">
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Resolution</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {resTargets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTarget(t.id)}
                      className={clsx(
                        'flex items-center gap-2 rounded-[var(--r-control)] border px-2.5 py-2 text-left text-xs',
                        targetId === t.id
                          ? 'border-accent bg-accent-soft font-semibold text-accent'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      <GIcon name={t.icon ?? '4k'} size={16} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{t.label}</div>
                        <div className="truncate text-2xs text-ink-muted">{t.badge}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-muted">Stock footage presets</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {stockTargets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTarget(t.id)}
                      className={clsx(
                        'flex items-center gap-2 rounded-[var(--r-control)] border px-2.5 py-2 text-left text-xs',
                        targetId === t.id
                          ? 'border-accent bg-accent-soft font-semibold text-ink'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      {t.platformId && <PlatformLogo id={t.platformId} size={18} />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{t.label}</div>
                        <div className="truncate text-2xs text-ink-muted">{t.badge}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">Container</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VIDEO_OUTPUT_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setOutFormat(fmt.id)}
                        className={clsx(
                          'flex h-9 items-center justify-center gap-1.5 rounded-[var(--r-control)] border text-xs font-semibold',
                          outFormat === fmt.id
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-surface text-ink hover:bg-surface-2',
                        )}
                      >
                        <FormatIcon format={fmt.id} size={15} />
                        <span>{fmt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">Frame rate</div>
                  <div className="grid grid-cols-3 gap-1">
                    {([24, 30, 60] as const).map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFps(rate)}
                        className={clsx(
                          'h-9 rounded-[var(--r-control)] border text-xs font-semibold tabular-nums',
                          fps === rate
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-surface text-ink hover:bg-surface-2',
                        )}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={`Bitrate (${bitrateMbps} Mbps)`}>
                  <input
                    type="range"
                    min={12}
                    max={80}
                    step={4}
                    value={bitrateMbps}
                    onChange={(e) => setBitrateMbps(Number(e.target.value))}
                    className="mt-1.5 w-full accent-[var(--accent)]"
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <Switch checked={keepAudio} onChange={setKeepAudio} label="Preserve audio" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-h-[30rem] min-w-0 flex-col gap-4">
          {activeJob ? (
            <Card>
              <CardHeader
                title={activeJob.result?.filename ?? activeJob.name}
                icon={<GIcon name="play_arrow" size={17} />}
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<GIcon name="photo_camera" size={14} />}
                    onClick={() => void captureFrameToLibrary()}
                  >
                    Save 4K still to Library
                  </Button>
                }
              />
              <video
                ref={playerRef}
                src={activeJob.outUrl ?? activeJob.srcUrl}
                controls
                playsInline
                className="max-h-[380px] w-full rounded-[var(--r-control)] border border-line bg-black object-contain"
              />
            </Card>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) void addVideos(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[18rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/30"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent">
                <GIcon name="videocam" size={22} />
              </span>
              <div className="text-sm font-semibold text-ink">Drop videos</div>
              <div className="text-xs text-ink-muted">MP4, MOV, WebM and MKV clips supported</div>
            </div>
          )}

          {jobs.length > 0 && (
            <Card>
              <CardHeader title={`Clips (${jobs.length})`} icon={<GIcon name="movie" size={17} />} />
              <div className="divide-y divide-line">
                {jobs.map((job) => {
                  const planned = resolveVideoDimensions(
                    job.meta.width,
                    job.meta.height,
                    activeTarget.longEdge,
                  );
                  return (
                    <div key={job.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setActiveId(job.id)}
                        className="flex h-12 w-18 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-xs)] border border-line bg-surface-2"
                      >
                        {job.meta.posterUrl ? (
                          <img src={job.meta.posterUrl} alt={job.name} className="size-full object-cover" />
                        ) : (
                          <GIcon name="movie" size={18} className="text-ink-muted" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-ink">
                          {job.result?.filename ?? job.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted tabular-nums">
                          <span>
                            {job.meta.width}x{job.meta.height}
                          </span>
                          <GIcon name="arrow_forward" size={12} />
                          <span className="font-medium text-ink">
                            {job.result
                              ? `${job.result.width}x${job.result.height} · ${job.result.fps} fps`
                              : `${planned.width}x${planned.height} · ${fps} fps`}
                          </span>
                          <span>·</span>
                          <span>{formatDuration(job.meta.duration)}</span>
                          {job.result && (
                            <Badge tone="brand">{formatBytes(job.result.sizeBytes)}</Badge>
                          )}
                        </div>
                        {job.status === 'running' && (
                          <div className="mt-1.5 space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                              <div
                                className="h-full rounded-full bg-accent transition-[width]"
                                style={{ width: `${Math.max(5, Math.round(job.progress * 100))}%` }}
                              />
                            </div>
                            {job.statusText && (
                              <div className="text-2xs text-ink-muted tabular-nums">{job.statusText}</div>
                            )}
                          </div>
                        )}
                        {job.error && (
                          <div className="mt-1 text-2xs font-medium text-danger">{job.error}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {job.result && (
                          <Button
                            size="xs"
                            variant="primary"
                            icon={<GIcon name="download" size={13} />}
                            onClick={() => triggerBlobDownload(job.result!.blob, job.result!.filename)}
                          >
                            Save {job.result.format.toUpperCase()}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeJob(job.id)}
                          className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-danger"
                          aria-label="Remove video"
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
              title="Video presets"
              icon={<GIcon name="memory" size={17} />}
              action={<Badge tone="neutral">{filteredModels.length}</Badge>}
            />

            <p className="mb-3 text-2xs text-ink-muted">Built-in resampling. Check model licences before commercial use.</p>

            <div className="mb-3 flex flex-wrap gap-1">
              {VIDEO_PURPOSES.map((p) => (
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
                  badge={model.badge}
                  license={model.license}
                  sizeMB={model.sizeMB}
                  selected={modelId === model.id}
                  builtin={model.runtime === 'builtin'}
                  installed={Boolean(installed[model.id])}
                  desktopOnly={model.runtime !== 'builtin'}
                  isDesktop={desktop.isDesktop}
                  progress={dlProgress[model.id]}
                  onSelect={() => selectModel(model)}
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
