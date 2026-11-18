import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Select, Switch } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/Misc';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { desktop, triggerBlobDownload } from '@/lib/desktop';
import { formatBytes } from '@/lib/modelStore';
import {
  doctorSummary,
  inspectJpeg,
  reencodeRaster,
  stripJpegMetadata,
  type JpegReport,
} from '@/lib/stock/filedoctor';
import { sizeCapOptions } from '@/lib/stock/sizecaps';
import { analyzeEps, analyzeSvg, sanitizeSvg } from '@/lib/stock/vectorcheck';

type PrepareTab = 'privacy' | 'resize' | 'vectors' | 'duplicates';

export function PreparePage() {
  const { items, getBlob, removeItems } = useLibrary();
  const toast = useToast();

  const [tab, setTab] = useState<PrepareTab>('privacy');
  const [stripIrb, setStripIrb] = useState(false);
  const [reports, setReports] = useState<Record<string, JpegReport>>({});
  const [vectorNotes, setVectorNotes] = useState<Record<string, string[]>>({});
  const [maxMB, setMaxMB] = useState('45');
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);

  const jpegs = useMemo(() => items.filter((i) => i.format === 'jpg'), [items]);
  const rasters = useMemo(
    () => items.filter((i) => i.format === 'jpg' || i.format === 'png' || i.format === 'webp'),
    [items],
  );
  const vectors = useMemo(
    () => items.filter((i) => i.format === 'svg' || i.format === 'eps'),
    [items],
  );

  const dupGroups = useMemo(() => {
    const bySig = new Map<string, typeof items>();
    for (const it of items) {
      const key = `${it.format}:${it.sizeBytes}:${it.width ?? 0}x${it.height ?? 0}`;
      const list = bySig.get(key) ?? [];
      list.push(it);
      bySig.set(key, list);
    }
    return Array.from(bySig.values()).filter((g) => g.length > 1);
  }, [items]);

  async function scanJpegs() {
    setBusy(true);
    try {
      const next: Record<string, JpegReport> = {};
      for (const it of jpegs) {
        const blob = await getBlob(it.id);
        if (!blob) continue;
        next[it.id] = inspectJpeg(new Uint8Array(await blob.arrayBuffer()));
      }
      setReports(next);
      toast.success(`Scanned ${Object.keys(next).length} JPG files`);
    } finally {
      setBusy(false);
    }
  }

  async function cleanJpegs() {
    setBusy(true);
    let cleaned = 0;
    let untouched = 0;
    const next: Record<string, JpegReport> = { ...reports };
    try {
      for (const it of jpegs) {
        const blob = await getBlob(it.id);
        if (!blob) continue;
        const src = new Uint8Array(await blob.arrayBuffer());
        const { bytes, removed } = stripJpegMetadata(src, { photoshop: stripIrb });
        if (!removed.length) {
          untouched += 1;
          next[it.id] = inspectJpeg(src);
          continue;
        }
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        if (it.path && desktop.isDesktop) {
          await desktop.fs.writeBytes(it.path, copy);
        } else {
          triggerBlobDownload(new Blob([copy], { type: 'image/jpeg' }), it.name);
        }
        cleaned += 1;
        // Re-inspect the cleaned bytes so the row stops advertising tags that
        // are gone and the list reflects reality straight away.
        next[it.id] = inspectJpeg(copy);
      }
      setReports(next);
      if (cleaned > 0) {
        toast.success(
          `Stripped metadata from ${cleaned} file${cleaned === 1 ? '' : 's'}`,
          untouched > 0 ? `${untouched} file${untouched === 1 ? ' was' : 's were'} already clean.` : undefined,
        );
      } else {
        toast.info('Nothing to remove', 'These files carry no camera EXIF or GPS tags.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function fitToSizeCap() {
    setBusy(true);
    let saved = 0;
    try {
      const cap = Number(maxMB) || 45;
      for (const it of rasters) {
        const blob = await getBlob(it.id);
        if (!blob) continue;
        const res = await reencodeRaster(blob, {
          format: it.format as 'jpg' | 'png' | 'webp',
          quality: quality / 100,
          maxMB: cap,
          maxEdge: 10000,
        });
        triggerBlobDownload(res.blob, it.name);
        saved++;
      }
      if (saved > 0) toast.success(`Processed ${saved} files under ${cap} MB`);
    } finally {
      setBusy(false);
    }
  }

  async function inspectVectors() {
    setBusy(true);
    try {
      const notes: Record<string, string[]> = {};
      for (const it of vectors) {
        const blob = await getBlob(it.id);
        if (!blob) continue;
        const text = await blob.text();
        if (it.format === 'svg') {
          const rep = analyzeSvg(text);
          const list: string[] = [];
          if (rep.hasScript) list.push('Contains script tags');
          if (rep.eventHandlers > 0) list.push('Contains inline event attributes');
          if (rep.externalRefs.length > 0) list.push('Contains external links');
          if (rep.editorJunk.length > 0) list.push(`Editor metadata: ${rep.editorJunk.join(', ')}`);
          if (rep.embeddedRasters > 0) list.push('Contains embedded raster tags');
          notes[it.id] = list.length ? list : ['Clean submission SVG'];
        } else {
          const rep = analyzeEps(text);
          notes[it.id] = rep.notes.length ? rep.notes : ['Clean EPS structure'];
        }
      }
      setVectorNotes(notes);
      toast.success(`Checked ${Object.keys(notes).length} vector files`);
    } finally {
      setBusy(false);
    }
  }

  async function cleanSvgItem(id: string, name: string) {
    const blob = await getBlob(id);
    if (!blob) return;
    const { text, removed } = sanitizeSvg(await blob.text());
    triggerBlobDownload(new Blob([text], { type: 'image/svg+xml' }), name);
    toast.success(removed.length ? 'Cleaned SVG downloaded' : 'SVG verified clean');
  }

  if (items.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Prepare" />
        <Card>
          <EmptyState
            icon={<GIcon name="tune" size={26} />}
            title="No files in Library"
            description="Import images or vectors first to inspect EXIF, file size and vector structure."
            action={
              <ButtonLink to="/library" size="sm" variant="primary" icon={<GIcon name="photo_library" size={15} />}>
                Open Library
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Prepare" />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'privacy', label: 'EXIF & GPS', icon: <GIcon name="camera" size={14} />, count: jpegs.length },
          { id: 'resize', label: 'Size Cap', icon: <GIcon name="compress" size={14} />, count: rasters.length },
          { id: 'vectors', label: 'Vectors', icon: <GIcon name="polyline" size={14} />, count: vectors.length },
          { id: 'duplicates', label: 'Duplicates', icon: <GIcon name="content_copy" size={14} />, count: dupGroups.length },
        ]}
      />

      {tab === 'privacy' && (
        <Card>
          <CardHeader
            title="EXIF & GPS Cleanup"
            icon={<GIcon name="camera" size={17} />}
            action={
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  loading={busy}
                  disabled={jpegs.length === 0}
                  icon={<GIcon name="search" size={14} />}
                  onClick={() => void scanJpegs()}
                >
                  Scan JPGs
                </Button>
                <Button
                  size="xs"
                  variant="primary"
                  loading={busy}
                  disabled={jpegs.length === 0}
                  icon={<GIcon name="cleaning_services" size={14} />}
                  onClick={() => void cleanJpegs()}
                >
                  Strip EXIF & GPS
                </Button>
              </div>
            }
          />
          <div className="mb-3">
            <Switch
              checked={stripIrb}
              onChange={setStripIrb}
              label="Also remove Photoshop IRB blocks (keeps XMP and sRGB ICC)"
            />
          </div>
          <div className="divide-y divide-line">
            {jpegs.map((it) => {
              const rep = reports[it.id];
              const tags = rep ? doctorSummary(rep) : [];
              return (
                <div key={it.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <span className="truncate font-medium text-ink">{it.name}</span>
                  <div className="flex items-center gap-1">
                    {rep ? (
                      tags.length ? (
                        tags.map((t) => (
                          <Badge key={t} tone={t.startsWith('GPS') ? 'danger' : 'neutral'}>
                            {t.replace('!', '')}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="brand">Clean</Badge>
                      )
                    ) : (
                      <span className="text-2xs text-ink-faint">{formatBytes(it.sizeBytes)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'resize' && (
        <Card>
          <CardHeader
            title="Marketplace File Size Fit"
            icon={<GIcon name="compress" size={17} />}
            action={
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                disabled={rasters.length === 0}
                icon={<GIcon name="download" size={15} />}
                onClick={() => void fitToSizeCap()}
              >
                Export fitted files ({rasters.length})
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Target budget">
              <Select
                value={maxMB}
                onChange={(e) => setMaxMB(e.target.value)}
                options={sizeCapOptions(100)}
              />
            </Field>
            <Field label={`Starting quality (${quality}%)`}>
              <input
                type="range"
                min={65}
                max={98}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
            </Field>
          </div>
        </Card>
      )}

      {tab === 'vectors' && (
        <Card>
          <CardHeader
            title="SVG & EPS Inspector"
            icon={<GIcon name="polyline" size={17} />}
            action={
              <Button
                size="xs"
                variant="primary"
                loading={busy}
                disabled={vectors.length === 0}
                icon={<GIcon name="fact_check" size={14} />}
                onClick={() => void inspectVectors()}
              >
                Inspect vectors
              </Button>
            }
          />
          {vectors.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-muted">No SVG or EPS files in Library.</div>
          ) : (
            <div className="divide-y divide-line">
              {vectors.map((it) => (
                <div key={it.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink">{it.name}</div>
                    {(vectorNotes[it.id] ?? []).map((n, i) => (
                      <div key={i} className="mt-0.5 text-2xs text-ink-muted">
                        {n}
                      </div>
                    ))}
                  </div>
                  {it.format === 'svg' && (
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={<GIcon name="cleaning_services" size={13} />}
                      onClick={() => void cleanSvgItem(it.id, it.name)}
                    >
                      Clean SVG
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'duplicates' && (
        <Card>
          <CardHeader title="Duplicate Check" icon={<GIcon name="content_copy" size={17} />} />
          {dupGroups.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-muted">No duplicate files found.</div>
          ) : (
            <div className="space-y-3">
              {dupGroups.map((group, idx) => (
                <div key={idx} className="rounded-[var(--r-control)] border border-line p-3">
                  <div className="mb-2 text-xs font-semibold text-ink">
                    Matching set ({group.length} files)
                  </div>
                  <div className="space-y-1.5">
                    {group.map((it, i) => (
                      <div key={it.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-ink">{it.name}</span>
                        {i > 0 && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-danger"
                            onClick={() => removeItems([it.id])}
                          >
                            Remove copy
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
