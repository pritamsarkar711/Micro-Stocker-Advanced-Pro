import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { GIcon } from '@/components/ui/GoogleIcon';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { FormatIcon } from '@/components/ui/FormatIcon';
import { ItemEditor } from '@/components/stock/ItemEditor';
import { AiPanel } from '@/components/settings/AiPanel';
import { useApp } from '@/state/AppState';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { desktop } from '@/lib/desktop';
import { DEFAULT_AI, loadAiSettings, PROVIDERS, type AiSettings } from '@/lib/stock/ai';
import { formatMetadataForClipboard, parseKeywordInput } from '@/lib/stock/metadata';
import { formatBytes } from '@/lib/modelStore';

/** Row preview that loads its blob only when the row actually renders. */
function PreviewThumb({
  item,
}: {
  item: { id: string; name: string; format: string; thumbUrl?: string };
}) {
  const { ensureThumb } = useLibrary();
  useEffect(() => {
    if (!item.thumbUrl) void ensureThumb(item.id);
  }, [ensureThumb, item.id, item.thumbUrl]);
  return (
    <div className="checkerboard flex size-13 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-xs)] border border-line bg-surface-2">
      {item.thumbUrl ? (
        <img src={item.thumbUrl} alt={item.name} className="size-full object-cover" />
      ) : (
        <FormatIcon format={item.format as never} size={18} />
      )}
    </div>
  );
}

export function LibraryPage() {
  const {
    items,
    selected,
    watchingDir,
    importFiles,
    importFromDialog,
    removeItems,
    toggleSelect,
    selectAll,
    clearSelection,
    applyToMany,
    aiDraft,
    embedInto,
    exportMetadataCsv,
    startWatching,
    stopWatching,
  } = useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'untagged' | 'ready' | 'embedded'>('all');
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [batchKwOpen, setBatchKwOpen] = useState(false);
  const [batchKwText, setBatchKwText] = useState('');
  const [draftProgress, setDraftProgress] = useState<{ done: number; total: number } | null>(null);
  const [embedding, setEmbedding] = useState(false);
  // Large libraries would mount hundreds of full-size previews at once, so the
  // grid renders a window of rows and extends it on demand.
  const [visibleCount, setVisibleCount] = useState(60);
  // Removing artwork destroys metadata, so every delete asks first unless the
  // user turned the confirmation off in Settings.
  const [pendingRemove, setPendingRemove] = useState<{ ids: string[]; label: string } | null>(null);

  const { settings } = useApp();

  /** Ask first, or remove straight away when confirmations are switched off. */
  const requestRemove = useCallback(
    (ids: string[], label: string) => {
      if (!ids.length) return;
      if (settings.confirmRemove) {
        setPendingRemove({ ids, label });
        return;
      }
      removeItems(ids);
      if (activeId && ids.includes(activeId)) setActiveId(null);
      toast.success(`Removed ${ids.length} asset${ids.length === 1 ? '' : 's'}`, 'Files on disk were left alone.');
    },
    [settings.confirmRemove, removeItems, activeId, toast],
  );

  useEffect(() => {
    void loadAiSettings().then(setAiSettings);
  }, []);

  useEffect(() => {
    const paramId = searchParams.get('item');
    if (paramId && items.some((i) => i.id === paramId)) {
      setActiveId(paramId);
    } else if (!activeId && items[0]) {
      setActiveId(items[0].id);
    }
  }, [activeId, items, searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === 'untagged' && it.metadata.title.trim() && it.metadata.keywords.length >= 7) {
        return false;
      }
      if (filter === 'ready' && (!it.metadata.title.trim() || it.metadata.keywords.length < 7)) {
        return false;
      }
      if (filter === 'embedded' && !it.embeddedAt) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.metadata.title.toLowerCase().includes(q) ||
        it.metadata.keywords.some((k) => k.includes(q))
      );
    });
  }, [filter, items, search]);

  useEffect(() => {
    setVisibleCount(60);
  }, [filter, search]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const activeItem = items.find((i) => i.id === activeId) ?? filtered[0] ?? null;
  const targetIds = selected.size > 0 ? Array.from(selected) : filtered.map((i) => i.id);
  const provider = PROVIDERS[aiSettings.kind];

  async function handleBatchGenerate() {
    if (!targetIds.length || draftProgress) return;
    setDraftProgress({ done: 0, total: targetIds.length });
    try {
      const res = await aiDraft(targetIds, (done, total) => setDraftProgress({ done, total }));
      if (res.ok > 0) {
        toast.success(
          `Generated metadata for ${res.ok} file${res.ok === 1 ? '' : 's'}`,
          res.embedded > 0 ? `IPTC & XMP embedded in ${res.embedded}` : provider.name,
        );
      }
    } finally {
      setDraftProgress(null);
    }
  }

  async function handleBatchEmbed(download: boolean) {
    if (!targetIds.length || embedding) return;
    setEmbedding(true);
    try {
      const res = await embedInto(targetIds, { downloadInBrowser: download });
      if (res.ok > 0) {
        toast.success(
          download
            ? `Saved ${res.ok} upload ready file${res.ok === 1 ? '' : 's'}`
            : `Embedded IPTC & XMP into ${res.ok} file${res.ok === 1 ? '' : 's'}`,
        );
      }
    } finally {
      setEmbedding(false);
    }
  }

  async function handleCopySelectedMetadata() {
    const pool = items.filter((i) => targetIds.includes(i.id) && i.metadata.title.trim());
    if (!pool.length) {
      toast.info('Generate metadata first');
      return;
    }
    const text = pool
      .map((i) => `File: ${i.name}\n${formatMetadataForClipboard(i.metadata)}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied metadata for ${pool.length} file${pool.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Library & Metadata"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.eps,.ai,.svg,.tif,.tiff,.avif,.webp,.bmp,.gif,.ico"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void importFiles(e.target.files).then((added) => {
                    if (added[0]) setActiveId(added[0].id);
                  });
                }
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:border-accent"
            >
              <BrandLogo brand={provider.brand} size={15} />
              <span className="hidden sm:inline">{provider.name}</span>
              <GIcon name="tune" size={14} className="text-ink-muted" />
            </button>

            {desktop.isDesktop && (
              <Button
                size="sm"
                variant="secondary"
                icon={<GIcon name="folder_open" size={15} />}
                onClick={() =>
                  void (watchingDir ? stopWatching() : startWatching())
                }
              >
                {watchingDir ? 'Watching' : 'Watch folder'}
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="upload_file" size={15} />}
              onClick={() => {
                if (desktop.isDesktop) void importFromDialog();
                else fileRef.current?.click();
              }}
            >
              Import
            </Button>

            <Button
              size="sm"
              variant="primary"
              loading={Boolean(draftProgress)}
              disabled={targetIds.length === 0}
              icon={<GIcon name="brush" size={15} />}
              onClick={() => void handleBatchGenerate()}
            >
              {draftProgress
                ? `Generating ${draftProgress.done}/${draftProgress.total}`
                : `Generate (${targetIds.length})`}
            </Button>
          </>
        }
      />

      {/* Batch post generation actions bar */}
      {items.length > 0 && (
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files or tags"
              leading={<GIcon name="search" size={15} />}
              className="h-8 w-48 sm:w-56"
            />
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-8 w-36"
              options={[
                { value: 'all', label: `All (${items.length})` },
                { value: 'untagged', label: 'Needs tags' },
                { value: 'ready', label: 'Ready' },
                { value: 'embedded', label: 'XMP embedded' },
              ]}
            />
            <Button
              size="xs"
              variant="ghost"
              icon={<GIcon name="select_all" size={14} />}
              onClick={() => (selected.size === items.length ? clearSelection() : selectAll())}
            >
              {selected.size > 0 ? `Clear (${selected.size})` : 'Select all'}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              icon={<GIcon name="delete_sweep" size={14} />}
              onClick={() => requestRemove(items.map((item) => item.id), `all ${items.length} assets`)}
            >
              Clear library
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="xs"
              variant="secondary"
              icon={<GIcon name="content_copy" size={13} />}
              onClick={() => void handleCopySelectedMetadata()}
            >
              Copy metadata
            </Button>
            <Button
              size="xs"
              variant="secondary"
              loading={embedding}
              icon={<GIcon name="file_download" size={13} />}
              onClick={() => void handleBatchEmbed(!desktop.isDesktop)}
            >
              Embed & save files
            </Button>
            <Button
              size="xs"
              variant="secondary"
              icon={<GIcon name="table_chart" size={13} />}
              onClick={() => void exportMetadataCsv(targetIds, 'universal')}
            >
              Download CSV
            </Button>
            <Button
              size="xs"
              variant="ghost"
              icon={<GIcon name="local_offer" size={13} />}
              onClick={() => setBatchKwOpen(true)}
            >
              Add tags
            </Button>
            {selected.size > 0 && (
              <Button
                size="xs"
                variant="ghost"
                className="text-danger hover:text-danger"
                icon={<GIcon name="delete" size={13} />}
                onClick={() =>
                  requestRemove(
                    Array.from(selected),
                    `${selected.size} selected asset${selected.size === 1 ? '' : 's'}`,
                  )
                }
              >
                Remove
              </Button>
            )}
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
          }}
          aria-label="Import files into the library"
          className="flex min-h-[16rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed border-line-strong bg-surface px-5 py-10 text-center active:bg-surface-2 hover:border-accent hover:bg-accent-soft/25 sm:py-16"
        >
          <span className="inline-flex size-14 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent">
            <GIcon name="add_photo_alternate" size={28} />
          </span>
          <div className="text-[0.9375rem] font-semibold text-ink">Tap to import</div>
          <div className="max-w-[22rem] text-xs leading-relaxed text-ink-muted">
            JPG, PNG, WebP, TIFF, AVIF, SVG, EPS, AI. Existing titles and keywords are read on arrival.
          </div>
          <Button size="sm" variant="primary" className="mt-1 w-full max-w-[14rem]" icon={<GIcon name="upload_file" size={15} />}>
            Browse files
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {/* Asset grid */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
            }}
            className="xl:col-span-6"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleItems.map((item) => {
                const isActive = activeItem?.id === item.id;
                const isSelected = selected.has(item.id);
                const tagged =
                  Boolean(item.metadata.title.trim()) && item.metadata.keywords.length >= 7;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={clsx(
                      'flex cursor-pointer items-center gap-3 rounded-[var(--r-card)] border p-2.5 transition-colors',
                      isActive
                        ? 'border-accent bg-accent-soft/55'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className="inline-flex size-5 shrink-0 items-center justify-center text-ink-muted hover:text-accent"
                      aria-label={`Select ${item.name}`}
                    >
                      <GIcon
                        name={isSelected ? 'check_box' : 'check_box_outline_blank'}
                        size={18}
                        className={isSelected ? 'text-accent' : undefined}
                      />
                    </button>

                    <PreviewThumb item={item} />

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestRemove([item.id], item.name);
                      }}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--r-chip)] text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      aria-label={`Remove ${item.name} from the library`}
                      title="Remove from library"
                    >
                      <GIcon name="delete" size={16} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs leading-snug font-semibold text-ink">
                        {item.metadata.title || item.name}
                      </div>
                      <div className="mt-0.5 truncate text-2xs text-ink-muted">
                        {item.metadata.keywords.length} tags · {formatBytes(item.sizeBytes)}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        {tagged ? (
                          <Badge tone="brand">Tagged</Badge>
                        ) : (
                          <Badge tone="neutral">Untagged</Badge>
                        )}
                        {item.embeddedAt && <Badge tone="brand">XMP</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > visibleItems.length && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--r-card)] border border-line bg-surface px-3 py-2">
                <span className="text-2xs text-ink-muted">
                  Showing {visibleItems.length} of {filtered.length}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setVisibleCount((count) => count + 60)}
                >
                  Show 60 more
                </Button>
              </div>
            )}
          </div>

          {/* Right detail & metadata generator */}
          <div className="xl:col-span-6">
            {activeItem && (
              <Card>
                <CardHeader title="Metadata Editor" icon={<GIcon name="edit" size={17} />} />
                <ItemEditor
                  item={activeItem}
                  onRequestRemove={(ids) => {
                    const target = items.find((entry) => entry.id === ids[0]);
                    requestRemove(ids, target?.name ?? `${ids.length} assets`);
                  }}
                />
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(pendingRemove)}
        onClose={() => setPendingRemove(null)}
        title="Remove from library?"
        description={
          pendingRemove
            ? `${pendingRemove.label} will be removed from the library. Files on disk are never touched.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-danger hover:bg-danger/90"
              icon={<GIcon name="delete" size={15} />}
              onClick={() => {
                if (!pendingRemove) return;
                const ids = pendingRemove.ids;
                removeItems(ids);
                if (activeId && ids.includes(activeId)) setActiveId(null);
                setPendingRemove(null);
                toast.success(`Removed ${ids.length} asset${ids.length === 1 ? '' : 's'}`, 'Files on disk were left alone.');
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-[0.8125rem] text-ink-muted">
          Metadata, tags and embedded XMP records for these assets are deleted from the library.
          Re-import the file to work on it again.
        </p>
      </Modal>

      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI metadata provider"
        size="lg"
      >
        <AiPanel compact onChange={setAiSettings} />
      </Modal>

      <Modal
        open={batchKwOpen}
        onClose={() => setBatchKwOpen(false)}
        title={`Add keywords to ${targetIds.length} files`}
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setBatchKwOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const words = parseKeywordInput(batchKwText);
                if (words.length) {
                  applyToMany(targetIds, { addKeywords: words });
                  toast.success(`Added ${words.length} keywords to ${targetIds.length} files`);
                }
                setBatchKwText('');
                setBatchKwOpen(false);
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <Input
          value={batchKwText}
          onChange={(e) => setBatchKwText(e.target.value)}
          placeholder="Comma separated keywords"
        />
      </Modal>
    </div>
  );
}
