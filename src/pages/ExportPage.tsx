import { useMemo, useState } from 'react';

import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Misc';
import { GIcon } from '@/components/ui/GoogleIcon';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useLibrary } from '@/state/library';
import { useReleases } from '@/state/releases';
import { useToast } from '@/state/ToastState';
import { desktop } from '@/lib/desktop';
import { generateCsv, generateUniversalCsv } from '@/lib/stock/csv';
import { PLATFORM_LIST, PLATFORMS } from '@/lib/stock/platforms';
import { buildValidationIndex, validateItem, worstLevel } from '@/lib/stock/validate';
import { buildXmpPacket, sidecarFilename } from '@/lib/stock/xmp';
import type { PlatformId } from '@/lib/stock/types';

const CSV_PLATFORMS = PLATFORM_LIST.filter((p) => p.csv !== null);

export function ExportPage() {
  const { items, selected, embedInto, renameSafe } = useLibrary();
  const { releases } = useReleases();
  const toast = useToast();

  const [platformId, setPlatformId] = useState<PlatformId>('shutterstock');
  const [embedding, setEmbedding] = useState(false);

  const scope = useMemo(
    () => (selected.size > 0 ? items.filter((i) => selected.has(i.id)) : items),
    [items, selected],
  );

  const platform = PLATFORMS[platformId];

  const releasesFor = useMemo(
    () => (it: (typeof items)[number]) =>
      (it.releaseIds ?? [])
        .map((id) => releases.find((r) => r.id === id)?.name ?? '')
        .filter(Boolean),
    [releases],
  );

  const generated = useMemo(() => {
    if (!platform.csv || !scope.length) return null;
    try {
      return generateCsv(platformId, scope, releasesFor);
    } catch {
      return null;
    }
  }, [platform.csv, platformId, releasesFor, scope]);

  const checkSummary = useMemo(() => {
    const idx = buildValidationIndex(items);
    let ready = 0;
    let errors = 0;
    const perItem = scope.map((it) => {
      const issues = validateItem(it, platformId, items, idx);
      const lvl = worstLevel(issues);
      if (lvl === 'error') errors++;
      else ready++;
      return { item: it, issues, level: lvl };
    });
    return { ready, errors, perItem };
  }, [items, platformId, scope]);

  async function savePlatformCsv() {
    if (!generated || generated.rowCount === 0) {
      toast.error('No eligible rows to export');
      return;
    }
    for (const chunk of generated.chunks) {
      await desktop.fs.exportText({
        defaultName: chunk.filename,
        text: chunk.content,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
    }
    toast.success(`Exported ${platform.name} CSV`, `${generated.rowCount} rows`);
  }

  async function copyCsv() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.content);
      toast.success('CSV copied to clipboard');
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  async function saveUniversalCsv() {
    const out = generateUniversalCsv(scope);
    await desktop.fs.exportText({
      defaultName: out.filename,
      text: out.content,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    toast.success(`Saved ${out.filename}`, `${out.rowCount} rows`);
  }

  async function handleEmbedAll() {
    setEmbedding(true);
    try {
      const res = await embedInto(
        scope.map((i) => i.id),
        { downloadInBrowser: !desktop.isDesktop },
      );
      if (res.ok > 0) {
        toast.success(`IPTC & XMP embedded in ${res.ok} file${res.ok === 1 ? '' : 's'}`);
      }
    } finally {
      setEmbedding(false);
    }
  }

  async function handleRename() {
    const count = await renameSafe(
      scope.map((i) => i.id),
      platformId,
    );
    toast.info(count > 0 ? `Cleaned ${count} filename${count === 1 ? '' : 's'}` : 'All filenames are already clean');
  }

  async function exportSidecars() {
    for (const item of scope) {
      const packet = buildXmpPacket(item.metadata, { aiGenerated: item.flags.aiGenerated });
      await desktop.fs.exportText({
        defaultName: sidecarFilename(item.name),
        text: packet,
        filters: [{ name: 'XMP', extensions: ['xmp'] }],
      });
    }
    toast.success(`Saved ${scope.length} XMP file${scope.length === 1 ? '' : 's'}`);
  }

  if (items.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Export & CSV" />
        <Card>
          <EmptyState
            icon={<GIcon name="upload_file" size={26} />}
            title="No files to export yet"
            description="Import images or vectors in Library and generate metadata first."
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
      <PageHeader
        title="Export & CSV"
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={embedding}
              icon={<GIcon name="file_download" size={15} />}
              onClick={() => void handleEmbedAll()}
            >
              Embed IPTC & XMP ({scope.length})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<GIcon name="table_chart" size={15} />}
              onClick={() => void saveUniversalCsv()}
            >
              Universal CSV
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!generated || generated.rowCount === 0}
              icon={<GIcon name="download" size={15} />}
              onClick={() => void savePlatformCsv()}
            >
              Download {platform.name} CSV
            </Button>
          </>
        }
      />

      {/* Marketplace selector with HD official logos */}
      <Card>
        <CardHeader title="Marketplace" icon={<GIcon name="storefront" size={17} />} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CSV_PLATFORMS.map((p) => {
            const active = p.id === platformId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatformId(p.id)}
                className={clsx(
                  'flex items-center gap-2.5 rounded-[var(--r-control)] border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
                )}
              >
                <PlatformLogo id={p.id} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-ink">{p.name}</div>
                  <div className="truncate text-2xs text-ink-muted">
                    {p.keywords.min} to {p.keywords.max} tags
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* CSV output & actions */}
        <Card className="xl:col-span-7">
          <CardHeader
            title={`${platform.name} CSV`}
            icon={<PlatformLogo id={platformId} size={22} />}
            action={
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<GIcon name="drive_file_rename_outline" size={14} />}
                  onClick={() => void handleRename()}
                >
                  Clean filenames
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<GIcon name="code" size={14} />}
                  onClick={() => void exportSidecars()}
                >
                  XMP sidecars
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  icon={<GIcon name="content_copy" size={13} />}
                  onClick={() => void copyCsv()}
                >
                  Copy CSV
                </Button>
              </div>
            }
          />

          {generated && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Badge tone="brand">{generated.rowCount} rows</Badge>
                {generated.skipped.length > 0 && (
                  <Badge tone="danger">{generated.skipped.length} excluded by policy</Badge>
                )}
                <span>Columns: {platform.csv?.columns.join(', ')}</span>
              </div>

              <pre className="max-h-72 overflow-auto rounded-[var(--r-control)] border border-line bg-surface-2/70 p-3 font-mono text-2xs leading-relaxed text-ink">
                {generated.content.replace(/^\uFEFF/, '').slice(0, 4000)}
              </pre>
            </div>
          )}
        </Card>

        {/* Compliance check */}
        <Card className="xl:col-span-5">
          <CardHeader
            title="Validation"
            icon={<GIcon name="fact_check" size={17} />}
            action={
              <Badge tone={checkSummary.errors === 0 ? 'brand' : 'danger'}>
                {checkSummary.ready}/{scope.length} ready
              </Badge>
            }
          />

          <div className="max-h-80 divide-y divide-line overflow-y-auto">
            {checkSummary.perItem.map(({ item, issues, level }) => {
              const blocking = issues.filter((i) => i.level === 'error');
              return (
                <div key={item.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-ink">{item.name}</div>
                    {blocking[0] ? (
                      <div className="mt-0.5 text-2xs text-danger">{blocking[0].message}</div>
                    ) : (
                      <div className="mt-0.5 text-2xs text-ink-muted">
                        {item.metadata.keywords.length} keywords
                        {item.embeddedAt ? ' · IPTC & XMP embedded' : ''}
                      </div>
                    )}
                  </div>
                  <GIcon
                    name={level === 'error' ? 'cancel' : 'check_circle'}
                    size={16}
                    className={level === 'error' ? 'shrink-0 text-danger' : 'shrink-0 text-accent'}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
