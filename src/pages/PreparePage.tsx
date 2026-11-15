import { useMemo, useState } from 'react';
import { EyeOff, MapPin, ShieldCheck, Sparkles, Stethoscope, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Select, Switch } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { formatBytes } from '@/lib/stock/files';
import { megapixels, type StockItem } from '@/lib/stock/types';
import { inspectJpeg, reencodeRaster, stripJpegMetadata, type JpegReport } from '@/lib/stock/filedoctor';
import { PLATFORM_LIST } from '@/lib/stock/platforms';

interface Row {
  item: StockItem;
  report: JpegReport | null;
  raster: boolean;
}

const SIZE_TARGETS = [
  { value: '0', label: 'No size cap' },
  ...PLATFORM_LIST.filter((p) => p.maxFileMB <= 60).map((p) => ({ value: String(p.maxFileMB), label: `${p.name} cap (${p.maxFileMB} MB)` })),
  { value: 'custom', label: 'Custom…' },
];

export function PreparePage() {
  const library = useLibrary();
  const toast = useToast();
  const [stripPhotoshop, setStripPhotoshop] = useState(true);
  const [reencode, setReencode] = useState(true);
  const [format, setFormat] = useState<'keep' | 'jpg' | 'png' | 'webp'>('keep');
  const [quality, setQuality] = useState(0.95);
  const [sizeTarget, setSizeTarget] = useState('45');
  const [customMB, setCustomMB] = useState(30);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [reports, setReports] = useState<Record<string, JpegReport>>({});

  const rows: Row[] = useMemo(
    () =>
      library.items.map((item) => {
        const raster = ['jpg', 'png', 'webp'].includes(item.format);
        return { item, report: item.format === 'jpg' ? reports[item.id] ?? null : null, raster };
      }),
    [library.items, reports],
  );

  /* JPEG inspection needs the raw bytes, so it runs on demand (Scan button)
     and after every clean. */
  const refreshReports = async () => {
    const next: Record<string, JpegReport> = { ...reports };
    for (const item of library.items) {
      if (item.format !== 'jpg') continue;
      try {
        const bytes = await library.getItemBytes(item.id);
        next[item.id] = inspectJpeg(bytes);
      } catch {
        next[item.id] = { isJpeg: true, hasExif: false, hasGps: false, hasIcc: false, hasXmp: false, hasPhotoshop: false, segments: 0 };
      }
    }
    setReports(next);
    toast.info('Metadata scan complete', `${Object.values(next).filter((r) => r.hasExif || r.hasGps).length} file(s) carry EXIF/GPS data.`);
  };

  const maxMB = sizeTarget === 'custom' ? customMB : Number(sizeTarget) || 0;

  const cleanOne = async (row: Row) => {
    setBusyIds((prev) => new Set(prev).add(row.item.id));
    try {
      let bytes = await library.getItemBytes(row.item.id);
      const notes: string[] = [];

      if (row.item.format === 'jpg') {
        const stripped = stripJpegMetadata(bytes, { photoshop: stripPhotoshop });
        if (stripped.removed.length) {
          notes.push(`removed ${stripped.removed.join(' + ')}`);
          bytes = stripped.bytes;
        }
      }

      if (reencode && row.raster) {
        const outFormat = format === 'keep' ? (row.item.format as 'jpg' | 'png' | 'webp') : format;
        const result = await reencodeRaster(new Blob([bytes as unknown as BlobPart]), {
          format: outFormat,
          quality,
          maxMB: maxMB || undefined,
        });
        notes.push(`sRGB re-encode q${Math.round(result.quality * 100)}${result.scale < 1 ? ` @${Math.round(result.scale * 100)}%` : ''} in ${result.iterations} pass(es)`);
        bytes = new Uint8Array(await result.blob.arrayBuffer());
        if (outFormat !== row.item.format) {
          const newName = row.item.name.replace(/\.[^.]+$/, `.${outFormat}`);
          await library.renameItem(row.item.id, newName);
        }
      }

      const ok = await library.replaceBytes(row.item.id, bytes, { backup: true });
      if (ok) {
        setReports((prev) => {
          const next = { ...prev };
          delete next[row.item.id];
          return next;
        });
        toast.success(`Cleaned ${row.item.name}`, notes.join(' · ') || 'No changes needed');
      }
    } catch (error) {
      toast.error('Clean failed', error instanceof Error ? error.message : String(error));
    }
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(row.item.id);
      return next;
    });
  };

  const cleanAll = async () => {
    const targets = rows.filter((row) => row.raster);
    for (const row of targets) await cleanOne(row);
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'File',
      primary: true,
      render: (row) => (
        <span className="flex items-center gap-2">
          {row.item.thumbUrl ? <img src={row.item.thumbUrl} alt="" className="size-8 rounded-md border border-line object-cover" /> : <span className="size-8 rounded-md border border-line bg-surface-2" />}
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{row.item.name}</span>
            <span className="block text-[0.6875rem] text-fg-subtle tabular-nums">
              {row.item.width ?? '?'}×{row.item.height ?? '?'} · {formatBytes(row.item.sizeBytes)}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'privacy',
      header: 'Privacy / tech',
      hideBelow: 'md',
      render: (row) => {
        if (!row.raster) return <Badge tone="neutral">vector — untouched</Badge>;
        const report = row.report;
        if (!report) return <Badge tone="outline">scan…</Badge>;
        return (
          <span className="flex flex-wrap gap-1">
            {report.hasGps && <Badge tone="danger" icon={<MapPin className="size-3" />}>GPS</Badge>}
            {report.hasExif && <Badge tone="warn" icon={<EyeOff className="size-3" />}>EXIF</Badge>}
            {report.hasPhotoshop && <Badge tone="neutral">IRB</Badge>}
            {report.hasIcc && <Badge tone="ok">ICC</Badge>}
            {report.hasXmp && <Badge tone="brand">XMP</Badge>}
            {!report.hasExif && !report.hasGps && !report.hasPhotoshop && <Badge tone="ok" dot>clean</Badge>}
          </span>
        );
      },
    },
    {
      key: 'mp',
      header: 'MP',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (row) => megapixels(row.item) ?? 0,
      sortable: true,
      render: (row) => <span className="tabular-nums">{(megapixels(row.item) ?? 0).toFixed(1)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) =>
        row.raster ? (
          <Button size="xs" variant="outline" loading={busyIds.has(row.item.id)} icon={<Stethoscope className="size-3.5" />} onClick={() => cleanOne(row)}>
            Clean
          </Button>
        ) : (
          <span className="text-[0.6875rem] text-fg-subtle">n/a</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="File Doctor"
        description="Strip camera EXIF and GPS coordinates, drop Photoshop scratch data, and re-encode through an sRGB canvas at the exact quality/size each platform accepts — without ever touching your XMP keywords."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={refreshReports}>Scan metadata</Button>
            <Button size="sm" onClick={cleanAll} icon={<ShieldCheck className="size-4" />}>Clean all raster</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-xs leading-relaxed text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            JPEG EXIF can carry GPS coordinates, camera serials and lens data — a privacy leak and, on some portals, a
            rejection trigger. Cleaning keeps your embedded keywords (XMP) and colour profile; a <code>.msap-backup</code> copy
            is written next to the original on desktop.
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Library health" description="Raster files can be cleaned; vectors pass through untouched" flush>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.item.id}
            dense
            emptyTitle="Nothing to clean yet"
            emptyDescription="Import files in the Library first."
          />
        </Card>

        <Card title="Cleaning recipe" description="Applied per file or to the whole batch">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <Switch checked={stripPhotoshop} onChange={setStripPhotoshop} label="Remove Photoshop IRB segment" description="Paths/clipping metadata; harmless to remove for stock JPEGs." />
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <Switch checked={reencode} onChange={setReencode} label="Re-encode via sRGB canvas" description="Normalises colour space and lets us hit exact size targets." />
            </div>

            {reencode && (
              <>
                <Field label="Output format">
                  <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} options={[
                    { value: 'keep', label: 'Keep current format' },
                    { value: 'jpg', label: 'JPEG (stock standard)' },
                    { value: 'png', label: 'PNG (lossless / transparency)' },
                    { value: 'webp', label: 'WebP (small previews)' },
                  ]} />
                </Field>
                <Field label={`JPEG/WebP quality ${Math.round(quality * 100)}%`} hint="Portals expect 90-100; the doctor lowers it only if a size cap forces it.">
                  <input type="range" min={0.6} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
                </Field>
                <Field label="Size target" hint="Quality steps down first; resolution only as a last resort.">
                  <Select value={sizeTarget} onChange={(e) => setSizeTarget(e.target.value)} options={SIZE_TARGETS} />
                </Field>
                {sizeTarget === 'custom' && (
                  <Field label="Custom cap (MB)">
                    <input type="number" min={1} max={500} value={customMB} onChange={(e) => setCustomMB(Number(e.target.value))} className="h-10 w-28 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg" />
                  </Field>
                )}
              </>
            )}

            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-fg-subtle">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
              After cleaning, re-run validation on the Platforms tab of each item — resolution and size rules are re-checked
              against every marketplace automatically.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
