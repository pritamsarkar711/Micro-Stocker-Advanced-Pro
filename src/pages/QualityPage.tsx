import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';
import { useLibrary } from '@/state/library';
import { triggerBlobDownload } from '@/lib/desktop';
import {
  analyseEpsFile,
  analyseImage,
  analyseSvgFile,
  differenceHash,
  measurePixels,
  type QualityReport,
  type Severity,
  type Verdict,
} from '@/lib/stock/quality';
import type { PlatformId } from '@/lib/stock/types';

interface CheckItem {
  id: string;
  name: string;
  bytes: number;
  kind: 'photo' | 'vector';
  status: 'running' | 'done' | 'error';
  error?: string;
  report?: QualityReport;
  previewUrl?: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 };

const VERDICT_META: Record<Verdict, { label: string; tone: 'ok' | 'warn' | 'danger'; icon: 'check_circle' | 'cancel' | 'info' }> = {
  ready: { label: 'Ready', tone: 'ok', icon: 'check_circle' },
  review: { label: 'Review', tone: 'warn', icon: 'info' },
  reject: { label: 'At risk', tone: 'danger', icon: 'cancel' },
};

const readText = (file: File) => file.text();

async function analyseFile(
  file: File,
  libraryHashes: Array<{ name: string; hash: string }>,
): Promise<{ report: QualityReport; previewUrl?: string }> {
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'svg') {
    return { report: analyseSvgFile(await readText(file), name, file.size) };
  }
  if (ext === 'eps' || ext === 'ai') {
    return { report: analyseEpsFile(await readText(file), name, file.size) };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 720 / Math.max(width, height));
  canvas.width = Math.max(2, Math.round(width * scale));
  canvas.height = Math.max(2, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable in this environment.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const stats = measurePixels(pixels.data, canvas.width, canvas.height);
  const hash = differenceHash(pixels.data, canvas.width, canvas.height);

  return {
    report: analyseImage(
      { name, bytes: file.size, width, height, type: file.type, stats, hash },
      libraryHashes,
    ),
    previewUrl: canvas.toDataURL('image/jpeg', 0.6),
  };
}

function ScoreRing({ score, verdict }: { score: number; verdict: Verdict }) {
  const stroke = verdict === 'ready' ? 'var(--ok)' : verdict === 'review' ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 97.4} 97.4`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.8125rem] font-bold tabular-nums text-ink">
        {score}
      </span>
    </div>
  );
}

type Issue = { id: string; severity: 'error' | 'warn' | 'info'; title: string; detail: string; fix?: string };

/**
 * Map the worst findings to the one tool that actually fixes them, so the
 * report ends with an action instead of a wall of red text.
 */
function suggestNextStep(issues: Issue[]): { tool: string; to: string; label: string } {
  const active = issues.filter((issue) => issue.severity !== 'info');
  const ids = new Set(active.map((issue) => issue.id));
  const titles = active.map((issue) => issue.title.toLowerCase()).join(' ');
  const has = (...prefixes: string[]) => prefixes.some((prefix) => Array.from(ids).some((id) => id.startsWith(prefix)));

  // Resolution and focus are rejection reasons that no encoder can fix, so they
  // outrank file weight even when both are present.
  if (has('img-resolution', 'img-soft', 'img-slightly-soft')) {
    return {
      tool: 'Upscaler',
      to: '/upscale',
      label: 'Reach the agency minimum first: enlarge with the suggested model and detail recovery.',
    };
  }
  if (has('svg-unsafe', 'svg-foreign-object', 'svg-editor-data', 'svg-complex')) {
    return {
      tool: 'Prepare',
      to: '/prepare',
      label: 'Clean the vector before upload: scripts, editor data and embedded HTML are removed there.',
    };
  }
  if (has('img-weight', 'img-compression') && /\bMB\b|weight|size limit/.test(titles)) {
    return {
      tool: 'Optimizer',
      to: '/optimize',
      label: 'Re-encode at the visually lossless sweet spot to clear the file size limit.',
    };
  }
  if (has('img-clipping', 'img-dark', 'img-bright', 'img-cast', 'img-saturation', 'img-noise')) {
    return {
      tool: 'Prepare',
      to: '/prepare',
      label: 'Correct exposure and colour in Prepare, then re-check the file.',
    };
  }
  if (has('img-weight', 'img-compression')) {
    return {
      tool: 'Optimizer',
      to: '/optimize',
      label: 'Re-encode at the visually lossless sweet spot to recover detail lost to heavy compression.',
    };
  }
  return { tool: 'Library', to: '/library', label: 'Fix the flagged items, then run the check again.' };
}

export function QualityPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { items, getBlob } = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const done = checks.filter((c) => c.status === 'done' && c.report);
    return {
      total: checks.length,
      ready: done.filter((c) => c.report!.verdict === 'ready').length,
      review: done.filter((c) => c.report!.verdict === 'review').length,
      risk: done.filter((c) => c.report!.verdict === 'reject').length,
    };
  }, [checks]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.size > 0);
      if (list.length === 0) return;
      setBusy(true);
      const ids = list.map((f) => `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`);
      setChecks((prev) => [
        ...prev,
        ...list.map((file, i) => ({
          id: ids[i],
          name: file.name,
          bytes: file.size,
          kind: /\.(svg|eps|ai)$/i.test(file.name) ? ('vector' as const) : ('photo' as const),
          status: 'running' as const,
        })),
      ]);

      // Hashes of library artwork power the near-duplicate check.
      const libraryHashes: Array<{ name: string; hash: string }> = [];
      for (const item of items.slice(0, 24)) {
        try {
          const blob = await getBlob(item.id);
          if (!blob || blob.type === 'application/postscript' || blob.type.includes('svg')) continue;
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = 48;
          canvas.height = 48;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) continue;
          ctx.drawImage(bitmap, 0, 0, 48, 48);
          const data = ctx.getImageData(0, 0, 48, 48);
          libraryHashes.push({ name: item.name, hash: differenceHash(data.data, 48, 48) });
          bitmap.close?.();
        } catch {
          /* unreadable library entries are skipped */
        }
      }

      for (let i = 0; i < list.length; i += 1) {
        const id = ids[i];
        try {
          const { report, previewUrl } = await analyseFile(list[i], libraryHashes);
          setChecks((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'done', report, previewUrl } : c)),
          );
        } catch (e) {
          setChecks((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, status: 'error', error: e instanceof Error ? e.message : 'Could not read this file.' }
                : c,
            ),
          );
        }
      }
      setBusy(false);
    },
    [items, getBlob],
  );

  /** Audit every asset already in the library, without re-picking files. */
  const addFromLibrary = useCallback(async () => {
    if (!items.length) {
      toast.info('No library files yet', 'Import artwork in Library first.');
      return;
    }
    const files: File[] = [];
    for (const item of items) {
      try {
        const blob = await getBlob(item.id);
        if (!blob) continue;
        files.push(new File([blob], item.name, { type: blob.type || 'application/octet-stream' }));
      } catch {
        /* unreadable entries are reported as missing below */
      }
    }
    const fresh = files.filter(
      (file) => !checks.some((check) => check.name === file.name && check.bytes === file.size),
    );
    if (!fresh.length) {
      toast.info('Everything is already checked');
      return;
    }
    await addFiles(fresh);
    toast.success(`Checking ${fresh.length} librar${fresh.length === 1 ? 'y file' : 'y files'}`);
  }, [items, getBlob, checks, addFiles, toast]);

  const downloadReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      files: checks
        .filter((c) => c.report)
        .map((c) => ({ name: c.name, bytes: c.bytes, ...c.report })),
    };
    triggerBlobDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      'quality-report.json',
    );
    toast.success('Report downloaded');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quality Checker"
        actions={
          <div className="flex items-center gap-2">
            {checks.length > 0 && (
              <>
                <Button size="sm" variant="secondary" icon={<GIcon name="download" size={16} />} onClick={downloadReport}>
                  Report
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<GIcon name="delete" size={16} />}
                  onClick={() => setChecks([])}
                >
                  Clear
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="photo_library" size={16} />}
              onClick={() => void addFromLibrary()}
              disabled={busy}
            >
              From Library
            </Button>
            <Button size="sm" icon={<GIcon name="add" size={16} />} onClick={() => fileRef.current?.click()}>
              Check files
            </Button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.svg,.eps,.ai"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {checks.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
          }}
          aria-label="Add files to check"
          className="flex min-h-[16rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-5 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/30 sm:min-h-[22rem] sm:py-14"
        >
          <span className="inline-flex size-14 items-center justify-center rounded-[var(--r-card)] bg-brand-soft text-brand">
            <GIcon name="fact_check" size={28} />
          </span>
          <div>
            <div className="text-[0.9375rem] font-semibold text-ink">Tap to add files</div>
            <div className="mt-1 max-w-[20rem] text-[0.8125rem] leading-relaxed text-ink-muted">
              JPG, PNG, WebP, AVIF, SVG, EPS. Checks sharpness, exposure and stock-eligibility.
            </div>
          </div>
          <Button size="sm" variant="primary" className="mt-1 w-full max-w-[14rem] sm:w-auto" icon={<GIcon name="upload_file" size={15} />}>
            Browse files
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.8125rem] font-medium text-ink">
              {summary.total} file{summary.total === 1 ? '' : 's'}
            </span>
            <Badge tone="ok" icon={<GIcon name="check_circle" size={13} />}>{summary.ready} ready</Badge>
            <Badge tone="warn" icon={<GIcon name="info" size={13} />}>{summary.review} to review</Badge>
            <Badge tone="danger" icon={<GIcon name="cancel" size={13} />}>{summary.risk} at risk</Badge>
            {busy && <span className="text-[0.75rem] text-ink-faint">analysing…</span>}
          </div>

          <div className="space-y-2.5">
            {checks.map((check) => {
              const report = check.report;
              const meta = report ? VERDICT_META[report.verdict] : null;
              const issues = report ? [...report.issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) : [];
              const expanded = openId === check.id;
              return (
                <Card key={check.id} padding="none" className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : check.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2/60"
                  >
                    <div className="checkerboard grid size-11 shrink-0 place-items-center overflow-hidden rounded-[var(--r-sm)] border border-line">
                      {check.previewUrl ? (
                        <img src={check.previewUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <GIcon name={check.kind === 'vector' ? 'polyline' : 'image'} size={20} className="text-ink-faint" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.875rem] font-semibold text-ink">{check.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[0.75rem] text-ink-muted">
                        {check.status === 'running' && 'Analysing…'}
                        {check.status === 'error' && (check.error ?? 'Could not read this file.')}
                        {report && (
                          <>
                            <span className="tabular-nums">{(check.bytes / 1024 / 1024).toFixed(2)} MB</span>
                            <span className="text-ink-faint">·</span>
                            <span>{issues.filter((i) => i.severity !== 'info').length} findings</span>
                            <span className="text-ink-faint">·</span>
                            <span>{report.platforms.filter((p) => p.ok).length}/{report.platforms.length} agencies</span>
                          </>
                        )}
                      </div>
                    </div>
                    {report && meta && (
                      <div className="flex items-center gap-3">
                        <Badge tone={meta.tone} icon={<GIcon name={meta.icon} size={13} />}>
                          {meta.label}
                        </Badge>
                        <ScoreRing score={report.score} verdict={report.verdict} />
                      </div>
                    )}
                    <GIcon
                      name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                      size={18}
                      className="shrink-0 text-ink-faint"
                    />
                  </button>

                  {expanded && report && (
                    <div className="border-t border-line px-3.5 py-3.5">
                      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                        <div className="space-y-2">
                          {issues.some((issue) => issue.severity !== 'info') && (
                            <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-control)] border border-line bg-brand-soft/40 px-3 py-2">
                              <GIcon name="tune" size={14} className="shrink-0 text-brand" />
                              <span className="min-w-0 flex-1 text-[0.75rem] text-ink">
                                {suggestNextStep(issues).label}
                              </span>
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => navigate(suggestNextStep(issues).to)}
                              >
                                Open {suggestNextStep(issues).tool}
                              </Button>
                            </div>
                          )}
                          {issues.map((issue) => (
                            <div key={issue.id} className="flex items-start gap-2.5">
                              <span
                                className={clsx(
                                  'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full',
                                  issue.severity === 'error' && 'bg-danger-soft text-danger',
                                  issue.severity === 'warn' && 'bg-warn-soft text-warn',
                                  issue.severity === 'info' && 'bg-ok-soft text-ok',
                                )}
                              >
                                <GIcon
                                  name={issue.severity === 'error' ? 'cancel' : issue.severity === 'warn' ? 'info' : 'check_circle'}
                                  size={13}
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="text-[0.8125rem] font-semibold text-ink">{issue.title}</div>
                                <div className="text-[0.75rem] leading-relaxed text-ink-muted">{issue.detail}</div>
                                {issue.fix && (
                                  <div className="mt-0.5 text-[0.75rem] text-brand">Fix: {issue.fix}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--r-control)] border border-line bg-surface-2/50 px-3 py-2.5">
                            {report.metrics.map((metric) => (
                              <div key={metric.label} className="min-w-0">
                                <div className="text-2xs text-ink-faint">{metric.label}</div>
                                <div className="truncate text-[0.8125rem] font-semibold text-ink tabular-nums">
                                  {metric.value}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <div className="text-2xs font-semibold tracking-wide text-ink-faint uppercase">
                              Agency readiness
                            </div>
                            <ul className="space-y-1">
                              {report.platforms.map((platform) => (
                                <li key={platform.id as PlatformId} className="flex items-center gap-2 text-[0.75rem]">
                                  <GIcon
                                    name={platform.ok ? 'check_circle' : 'cancel'}
                                    size={14}
                                    className={platform.ok ? 'text-ok' : 'text-danger'}
                                  />
                                  <span className="font-medium text-ink">{platform.name}</span>
                                  {!platform.ok && <span className="truncate text-ink-faint">{platform.reason}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
