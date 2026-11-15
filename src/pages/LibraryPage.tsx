import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Box,
  Download,
  FileImage,
  HardDrive,
  Layers,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Switch, Field } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { isDesktop } from '@/lib/desktop';
import { formatBytes } from '@/lib/stock/files';
import { megapixels, type StockItem } from '@/lib/stock/types';
import { validateEverywhere, worstLevel } from '@/lib/stock/validate';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
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

  const health = useMemo(() => {
    const map = new Map<string, ReturnType<typeof worstLevel>>();
    for (const item of library.items) {
      const all = Object.values(validateEverywhere(item, library.items)).flat();
      map.set(item.id, worstLevel(all));
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

  return (
    <>
      <PageHeader
        title="Library"
        description="Import EPS, AI, SVG, JPG, PNG and WebP assets. Embedded IPTC/XMP is read on import; generated metadata can be written back into the files."
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
            <Button
              size="sm"
              loading={busy}
              icon={isDesktop ? <HardDrive className="size-4" /> : <Upload className="size-4" />}
              onClick={() => (isDesktop ? onImport() : fileInputRef.current?.click())}
            >
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
        <Select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className="sm:w-44" options={[
          { value: 'all', label: 'All formats' },
          { value: 'jpg', label: 'JPG' },
          { value: 'png', label: 'PNG' },
          { value: 'webp', label: 'WebP' },
          { value: 'eps', label: 'EPS' },
          { value: 'ai', label: 'AI' },
          { value: 'svg', label: 'SVG' },
        ]} />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => library.setSelection(library.selection.size === library.items.length ? [] : library.items.map((i) => i.id))}
        >
          {library.selection.size === library.items.length && library.items.length > 0 ? 'Clear selection' : 'Select all'}
        </Button>
      </div>

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
            <LibraryCard key={item.id} item={item} level={health.get(item.id) ?? 'ok'} selected={library.selection.has(item.id)} onSelect={() => library.toggleSelect(item.id)} onOpen={() => setEditorId(item.id)} />
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
            <Button size="xs" variant="outline" icon={<Download className="size-3.5" />} onClick={() => { sessionStorage.setItem('msap:export-selection', JSON.stringify(selectedIds)); window.location.hash = '#/export'; }}>
              Export CSV
            </Button>
            <Button size="xs" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => library.removeItems(selectedIds)}>Remove</Button>
            <Button size="xs" variant="ghost" icon={<X className="size-3.5" />} onClick={() => library.setSelection([])} aria-label="Clear selection" />
          </div>
        </div>
      )}

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
      <div
        className={clsx(
          'card group relative overflow-hidden transition hover:border-line-strong',
          selected && 'ring-2 ring-brand/60',
        )}
      >
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

export function PlatformCountNote() {
  return <p className="text-xs text-fg-subtle">{PLATFORM_LIST.length} platforms configured</p>;
}
