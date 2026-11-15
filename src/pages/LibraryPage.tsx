import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Box,
  Copy,
  Download,
  FileImage,
  FileSpreadsheet,
  FolderSearch,
  HardDrive,
  Layers,
  PenLine,
  Plus,
  ScanSearch,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isDesktop } from '@/lib/desktop';
import { formatBytes } from '@/lib/stock/files';
import { megapixels, type StockItem } from '@/lib/stock/types';
import { validateEverywhere, worstLevel } from '@/lib/stock/validate';
import { findDuplicateClusters, type DuplicateCluster } from '@/lib/stock/dupes';
import { parseMetadataCsv, planApply } from '@/lib/stock/csvimport';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { ItemEditor } from '@/components/stock/ItemEditor';

const LEVEL_TONE = { error: 'danger', warn: 'warn', info: 'neutral', ok: 'ok' } as const;

export function LibraryPage() {
  const library = useLibrary();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [editorId, setEditorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* duplicate scanner */
  const [dupOpen, setDupOpen] = useState(false);
  const [dupState, setDupState] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });
  const [clusters, setClusters] = useState<DuplicateCluster[] | null>(null);

  /* metadata CSV import */
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRaw, setCsvRaw] = useState<string | null>(null);
  const [csvName, setCsvName] = useState('');
  const [csvDialect, setCsvDialect] = useState<PlatformId | ''>('');

  /* batch templates */
  const [tplOpen, setTplOpen] = useState(false);
  const [tplTitle, setTplTitle] = useState('{name} vector illustration, flat design element');
  const [tplDesc, setTplDesc] = useState('A clean {format} asset of {name}, part of a {count} piece series, ready for commercial use.');
  const [tplKeywords, setTplKeywords] = useState('set, collection, series');

  const filtered = useMemo(
    () =>
      library.items.filter(
        (item) =>
          (formatFilter === 'all' || item.format === formatFilter) &&
          (!query.trim() ||
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            item.metadata.title.toLowerCase().includes(query.toLowerCase()) ||
            item.metadata.keywords.some((k) => k.includes(query.toLowerCase()))),
      ),
    [library.items, query, formatFilter],
  );

  const csvParse = useMemo(
    () => (csvRaw ? parseMetadataCsv(csvRaw, csvDialect || undefined) : null),
    [csvRaw, csvDialect],
  );
  const csvMatch = useMemo(
    () => (csvParse ? planApply(library.items, csvParse.rows) : null),
    [csvParse, library.items],
  );

  const health = useMemo(() => {
    const map = new Map<string, keyof typeof LEVEL_TONE>();
    for (const item of library.items) {
      map.set(item.id, worstLevel(Object.values(validateEverywhere(item, library.items)).flat()));
    }
    return map;
  }, [library.items]);

  const selectedIds = Array.from(library.selection);
  const editorItem = library.items.find((i) => i.id === editorId) ?? null;

  const onImport = async (files?: FileList | null) => {
    setBusy(true);
    try {
      if (isDesktop) await library.importDesktopFiles();
      else if (files) await library.importBrowserFiles(Array.from(files));
    } catch (error) {
      toast.error('Import failed', error instanceof Error ? error.message : String(error));
    }
    setBusy(false);
  };

  const onBulkGenerate = async () => {
    setBusy(true);
    const result = await library.generateFor(selectedIds.length ? selectedIds : library.items.map((i) => i.id), {
      style: 'auto',
      categories: [],
      concepts: [],
    });
    setBusy(false);
    toast.success(`Metadata generated for ${result.done} file${result.done === 1 ? '' : 's'}`, result.aiUsed ? `${result.aiUsed} via your AI endpoint` : 'Local generator (offline)');
  };

  const onBulkEmbed = async () => {
    setBusy(true);
    const result = await library.embedFor(selectedIds.length ? selectedIds : library.items.map((i) => i.id), { backup: true });
    setBusy(false);
    if (result.done) toast.success(`Embedded metadata into ${result.done} file${result.done === 1 ? '' : 's'}`, 'IPTC/XMP written — files are upload-ready.');
    if (result.failed.length) toast.error(`${result.failed.length} file(s) could not be embedded`, result.failed.slice(0, 3).join(' · '));
  };

  const onScanDupes = async () => {
    setDupOpen(true);
    setClusters(null);
    setDupState({ running: true, done: 0, total: library.items.length });
    const raster = library.items.filter((i) => ['jpg', 'png', 'webp'].includes(i.format));
    setDupState({ running: true, done: 0, total: raster.length });
    const found = await findDuplicateClusters(raster, library.getItemBlob, 8, (done, total) => setDupState({ running: true, done, total }));
    setClusters(found);
    setDupState({ running: false, done: raster.length, total: raster.length });
    if (found.length === 0) toast.success('No near-duplicates found', 'Every raster file hashes uniquely at thumbnail scale.');
  };

  const onCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      setCsvRaw(text);
      setCsvName(file.name);
      setCsvDialect('');
      setCsvOpen(true);
    } catch (error) {
      toast.error('Could not read the CSV', error instanceof Error ? error.message : String(error));
    }
  };

  const onApplyCsv = () => {
    if (!csvParse) return;
    const result = library.applyMetadataRows(csvParse.rows);
    toast.success(
      `Metadata applied to ${result.matched} file${result.matched === 1 ? '' : 's'}`,
      result.missing.length
        ? `Not in library: ${result.missing.slice(0, 3).join(', ')}${result.missing.length > 3 ? '…' : ''}`
        : 'Titles, descriptions, keywords and flags merged.',
    );
    setCsvOpen(false);
    setCsvRaw(null);
    setCsvName('');
  };

  const applyTemplate = () => {
    const targets = selectedIds.length ? library.items.filter((i) => library.selection.has(i.id)) : library.items;
    const render = (tpl: string, item: StockItem, index: number) =>
      tpl
        .replaceAll('{name}', item.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim())
        .replaceAll('{format}', item.format.toUpperCase())
        .replaceAll('{index}', String(index + 1))
        .replaceAll('{count}', String(targets.length))
        .replaceAll('{category}', item.metadata.categories[0] ?? 'creative');
    targets.forEach((item, index) => {
      const extra = tplKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      library.setMetadata(item.id, {
        title: render(tplTitle, item, index).slice(0, 180),
        description: render(tplDesc, item, index).slice(0, 400),
        keywords: Array.from(new Set([...item.metadata.keywords, ...extra])).slice(0, 50),
      });
    });
    setTplOpen(false);
    toast.success(`Template applied to ${targets.length} file${targets.length === 1 ? '' : 's'}`, 'Variables: {name} {format} {index} {count} {category}');
  };

  return (
    <>
      <PageHeader
        title="Library"
        description="Import EPS, AI, SVG, JPG, PNG and WebP. Generate, edit and embed metadata."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.eps,.ai,.svg,.webp"
              className="hidden"
              onChange={(event) => onImport(event.target.files)}
            />
            <Button size="sm" loading={busy} icon={isDesktop ? <HardDrive className="size-4" /> : <Upload className="size-4" />} onClick={() => (isDesktop ? onImport() : fileInputRef.current?.click())}>
              Import files
            </Button>
            <Button size="sm" variant="outline" loading={busy} icon={<Wand2 className="size-4" />} onClick={onBulkGenerate}>
              Generate all
            </Button>
            <Button size="sm" variant="outline" loading={busy} icon={<PenLine className="size-4" />} onClick={onBulkEmbed}>
              Embed all
            </Button>
          </>
        }
      />

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, title or keyword…" className="pl-9" />
        </div>
        <Select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="sm:w-40"
          options={[
            { value: 'all', label: 'All formats' },
            { value: 'jpg', label: 'JPG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
            { value: 'eps', label: 'EPS' },
            { value: 'ai', label: 'AI' },
            { value: 'svg', label: 'SVG' },
          ]}
        />
        <Button size="sm" variant="outline" icon={<ScanSearch className="size-4" />} onClick={onScanDupes} disabled={library.items.length < 2}>
          Find duplicates
        </Button>
        <Button size="sm" variant="outline" icon={<Copy className="size-4" />} onClick={() => setTplOpen(true)} disabled={library.items.length === 0}>
          Template
        </Button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onCsvFile(file);
            event.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          icon={<FileSpreadsheet className="size-4" />}
          onClick={() => (csvRaw ? setCsvOpen(true) : csvInputRef.current?.click())}
          disabled={library.items.length === 0}
          title="Re-use an existing metadata CSV (this app, Xpiks or a portal download)"
        >
          Import CSV
        </Button>
        {isDesktop && (
          <Button
            size="sm"
            variant={library.watching ? 'success' : 'ghost'}
            icon={<FolderSearch className="size-4" />}
            onClick={() => (library.watching ? library.stopWatch() : library.startWatch())}
            title={library.watching ?? 'Watch a folder for new files'}
          >
            {library.watching ? 'Watching' : 'Watch folder'}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => library.setSelection(library.selection.size === library.items.length ? [] : library.items.map((i) => i.id))}>
          {library.selection.size === library.items.length && library.items.length > 0 ? 'Clear selection' : 'Select all'}
        </Button>
      </div>

      {library.watching && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft px-3 py-2 text-xs text-ok">
          <FolderSearch className="size-4 shrink-0" /> Auto-importing new stock files from <code className="truncate font-mono">{library.watching}</code>
        </p>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Box className="size-7" />}
            title={library.items.length === 0 ? 'Your library is empty' : 'Nothing matches the filter'}
            description={
              library.items.length === 0
                ? 'Import your stock files to start generating metadata, CSVs and upscales. On desktop the native file picker opens; in the browser preview use the file chooser.'
                : 'Adjust the search or format filter.'
            }
            action={
              <Button icon={<Plus className="size-4" />} onClick={() => (isDesktop ? onImport() : fileInputRef.current?.click())}>
                Import files
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid-auto-fill gap-3">
          {filtered.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              level={health.get(item.id) ?? 'ok'}
              selected={library.selection.has(item.id)}
              onSelect={() => library.toggleSelect(item.id)}
              onOpen={() => setEditorId(item.id)}
            />
          ))}
        </ul>
      )}

      {/* bulk bar */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-40 flex justify-center px-3 safe-bottom lg:bottom-4">
          <div className="card flex flex-wrap items-center gap-2 px-3 py-2 shadow-[var(--shadow-pop)]">
            <Badge tone="brand" dot>{selectedIds.length} selected</Badge>
            <Button size="xs" variant="outline" icon={<Wand2 className="size-3.5" />} onClick={onBulkGenerate}>Generate</Button>
            <Button size="xs" variant="outline" icon={<PenLine className="size-3.5" />} onClick={onBulkEmbed}>Embed</Button>
            <Button size="xs" variant="outline" icon={<Copy className="size-3.5" />} onClick={() => setTplOpen(true)}>Template</Button>
            <Button
              size="xs"
              variant="outline"
              icon={<Stethoscope className="size-3.5" />}
              onClick={() => {
                window.location.hash = '#/prepare';
              }}
            >
              File Doctor
            </Button>
            <Button
              size="xs"
              variant="outline"
              icon={<Download className="size-3.5" />}
              onClick={() => {
                sessionStorage.setItem('msap:export-selection', JSON.stringify(selectedIds));
                window.location.hash = '#/export';
              }}
            >
              Export CSV
            </Button>
            <Button size="xs" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => library.removeItems(selectedIds)}>Remove</Button>
            <Button size="xs" variant="ghost" icon={<X className="size-3.5" />} onClick={() => library.setSelection([])} aria-label="Clear selection" />
          </div>
        </div>
      )}

      {/* duplicates modal */}
      <Modal open={dupOpen} onClose={() => setDupOpen(false)} title="Near-duplicate scan" description="64-bit perceptual dHash; ≤ 8 differing bits = near-identical at thumbnail scale." size="lg">
        {dupState.running ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner size={5} />
            <p className="text-sm text-fg-muted tabular-nums">Hashing {dupState.done}/{dupState.total}…</p>
          </div>
        ) : clusters === null ? (
          <p className="py-8 text-center text-sm text-fg-muted">Starting scan…</p>
        ) : clusters.length === 0 ? (
          <EmptyState icon={<ScanSearch className="size-7" />} title="No near-duplicates" description="Every raster file in the library hashes uniquely. Safe to submit together." />
        ) : (
          <div className="flex flex-col gap-4">
            {clusters.map((cluster, index) => (
              <div key={index} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-fg">Cluster {index + 1} · {cluster.items.length} files</p>
                  <Badge tone="warn" dot>max distance {cluster.maxDistance}</Badge>
                </div>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {cluster.items.map((item, position) => (
                    <li key={item.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
                      {item.thumbUrl ? <img src={item.thumbUrl} alt="" className="size-10 rounded-md border border-line object-cover" /> : <FileImage className="size-10 text-fg-subtle" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-fg">{item.name}</span>
                        <span className="block text-[0.625rem] text-fg-subtle">{position === 0 ? 'keep (first)' : 'possible duplicate'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    library.setSelection(cluster.items.slice(1).map((i) => i.id));
                    setDupOpen(false);
                    toast.info('Duplicates selected', 'Review them, then Remove or clean from the bulk bar.');
                  }}
                >
                  Select all but the first
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* template modal */}
      <Modal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title="Batch metadata template"
        description={`Applies to ${selectedIds.length || library.items.length} file(s). Variables: {name} {format} {index} {count} {category}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTplOpen(false)}>Cancel</Button>
            <Button onClick={applyTemplate} icon={<Copy className="size-4" />}>Apply template</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title template">
            <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
          </Field>
          <Field label="Description template">
            <Textarea value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} />
          </Field>
          <Field label="Keywords to append (comma separated)" hint="Merged with existing keywords, de-duplicated, capped at 50.">
            <Input value={tplKeywords} onChange={(e) => setTplKeywords(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* metadata CSV import modal */}
      <Modal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        title="Import metadata CSV"
        description="Rows match library files by filename; titles, keywords and flags are merged."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => csvInputRef.current?.click()} icon={<Upload className="size-4" />}>
              {csvParse ? 'Choose another' : 'Choose CSV'}
            </Button>
            <Button
              onClick={onApplyCsv}
              disabled={!csvParse || !csvMatch || csvMatch.size === 0}
              icon={<FileSpreadsheet className="size-4" />}
            >
              Apply to library
            </Button>
          </>
        }
      >
        {csvParse ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {csvParse.platform ? (
                <Badge tone="brand">
                  <span className="flex items-center gap-1.5">
                    <PlatformLogo id={csvParse.platform} size={16} />
                    {PLATFORM_LIST.find((p) => p.id === csvParse.platform)?.name} dialect
                  </span>
                </Badge>
              ) : (
                <Badge tone="neutral">generic CSV</Badge>
              )}
              <Badge tone="outline">{csvParse.delimiter === '\t' ? 'TAB' : `"${csvParse.delimiter}"`}</Badge>
              <Badge tone="outline">{csvParse.hasHeader ? 'header row' : 'headerless'}</Badge>
              <Badge tone={csvParse.rows.length ? 'ok' : 'danger'}>{csvParse.rows.length} rows</Badge>
              {csvParse.skipped > 0 && <Badge tone="warn">{csvParse.skipped} skipped</Badge>}
              <Badge tone={csvMatch && csvMatch.size > 0 ? 'ok' : 'warn'}>
                {csvMatch?.size ?? 0} matched · {csvName}
              </Badge>
            </div>

            <Field label="Column order" hint="Headerless sheets are read positionally — pick the platform whose layout matches.">
              <Select
                value={csvDialect}
                onChange={(event) => setCsvDialect(event.target.value as PlatformId | '')}
                options={[
                  { value: '', label: csvParse.platform ? `Auto (${csvParse.platform})` : 'Auto-detect' },
                  ...PLATFORM_LIST.map((platform) => ({ value: platform.id, label: platform.name })),
                ]}
              />
            </Field>

            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
                  <tr>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2 text-right">Keywords</th>
                    <th className="px-3 py-2 text-right">In library</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {csvParse.rows.slice(0, 8).map((row, index) => {
                    const matched = Boolean(csvMatch?.get(row));
                    return (
                      <tr key={`${row.filename}-${index}`} className="bg-surface">
                        <td className="max-w-40 truncate px-3 py-2 font-mono text-fg" title={row.filename}>{row.filename}</td>
                        <td className="max-w-56 truncate px-3 py-2 text-fg-muted" title={row.title ?? ''}>{row.title || '—'}</td>
                        <td className="px-3 py-2 text-right text-fg tabular-nums">{row.keywords?.length ?? 0}</td>
                        <td className="px-3 py-2 text-right">
                          {matched ? <Badge tone="ok">yes</Badge> : <Badge tone="warn">no</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-fg-subtle">
              Rows that do not match a library filename are ignored — import the artwork first, then re-apply.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={<FileSpreadsheet className="size-7" />}
            title="Pick a metadata CSV"
            description="Exports from this app, Xpiks or a portal download all work — the dialect is detected automatically."
            action={<Button icon={<Upload className="size-4" />} onClick={() => csvInputRef.current?.click()}>Choose CSV</Button>}
          />
        )}
      </Modal>

      {editorItem && <ItemEditor item={editorItem} onClose={() => setEditorId(null)} />}
    </>
  );
}

function LibraryCard({
  item,
  level,
  selected,
  onSelect,
  onOpen,
}: {
  item: StockItem;
  level: keyof typeof LEVEL_TONE;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const mp = megapixels(item);
  return (
    <li>
      <div className={clsx('card group relative overflow-hidden transition hover:border-line-strong', selected && 'ring-2 ring-brand/60')}>
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <div className="relative flex h-36 items-center justify-center overflow-hidden bg-surface-2 sm:h-40">
            {item.thumbUrl ? (
              <img src={item.thumbUrl} alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-fg-subtle">
                {item.format === 'eps' || item.format === 'ai' || item.format === 'svg' ? <Layers className="size-8" /> : <FileImage className="size-8" />}
                <span className="font-mono text-xs uppercase">{item.format}</span>
              </span>
            )}
            <span className="absolute top-2 left-2 flex gap-1">
              <Badge tone="neutral" className="bg-black/55 text-white backdrop-blur">{item.format.toUpperCase()}</Badge>
              {mp !== null && <Badge tone="neutral" className="bg-black/55 text-white backdrop-blur tabular-nums">{mp.toFixed(1)} MP</Badge>}
            </span>
            <span className="absolute top-2 right-2">
              <Badge tone={LEVEL_TONE[level]} dot>{level === 'ok' ? 'ready' : level}</Badge>
            </span>
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-medium text-fg" title={item.name}>{item.name}</p>
            <p className="mt-1 truncate text-xs text-fg-muted">{item.metadata.title || 'No title yet'}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[0.6875rem] text-fg-subtle">
              <span className="tabular-nums">{formatBytes(item.sizeBytes)}</span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3" />
                {item.metadata.keywords.length} kw
                {item.embeddedAt && <Badge tone="ok" className="ml-1">embedded</Badge>}
              </span>
            </div>
          </div>
        </button>
        <label className="absolute bottom-3 left-3 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[0.6875rem] font-medium text-white backdrop-blur">
          <input type="checkbox" checked={selected} onChange={onSelect} className="size-3.5 accent-[var(--brand)]" />
          select
        </label>
      </div>
    </li>
  );
}
