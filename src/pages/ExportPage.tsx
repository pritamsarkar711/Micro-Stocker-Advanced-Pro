import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, FileSpreadsheet, PenLine, Send, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CodeBlock } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { desktop, isDesktop } from '@/lib/desktop';
import { buildPlatformCsv, withBom } from '@/lib/stock/csv';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';
import { sanitizeFilename } from '@/lib/stock/validate';
import { validateItem } from '@/lib/stock/validate';
import { loadSubmissions, saveSubmissions, setStatus } from '@/lib/stock/submissions';

export function ExportPage() {
  const library = useLibrary();
  const toast = useToast();
  const [enabled, setEnabled] = useState<Set<PlatformId>>(new Set(['shutterstock', 'adobe', 'freepik']));
  const [scope, setScope] = useState<'selection' | 'all'>('selection');
  const [busy, setBusy] = useState(false);

  /* selection handed over from the Library bulk bar */
  useEffect(() => {
    const raw = sessionStorage.getItem('msap:export-selection');
    if (raw) {
      try {
        library.setSelection(JSON.parse(raw) as string[]);
        setScope('selection');
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem('msap:export-selection');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (scope === 'selection' && library.selection.size > 0) {
      return library.items.filter((item) => library.selection.has(item.id));
    }
    return library.items;
  }, [scope, library.items, library.selection]);

  const exports = useMemo(
    () =>
      PLATFORM_LIST.filter((p) => enabled.has(p.id)).map((platform) => ({
        platform,
        result: buildPlatformCsv(rows, platform.id),
        blocking: rows.flatMap((row) => validateItem(row, platform.id, library.items).filter((i) => i.level === 'error')),
      })),
    [enabled, rows, library.items],
  );

  const toggle = (id: PlatformId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const download = async (filename: string, content: string) => {
    if (isDesktop) {
      const result = await desktop.fs.exportText({
        defaultName: filename,
        text: withBom(content),
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (result.ok) toast.success('CSV saved', result.filePath ? String(result.filePath) : undefined);
      else if (!result.canceled) toast.error('Save failed', result.error);
    } else {
      const url = URL.createObjectURL(new Blob([withBom(content)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success('CSV downloaded', filename);
    }
  };

  const onEmbedAll = async () => {
    setBusy(true);
    const result = await library.embedFor(rows.map((r) => r.id), { backup: true });
    setBusy(false);
    if (result.done) toast.success(`Embedded ${result.done} file${result.done === 1 ? '' : 's'}`, 'Upload-ready: portals will pre-fill from IPTC/XMP.');
    if (result.failed.length) toast.error(`${result.failed.length} failed`, result.failed.slice(0, 3).join(' · '));
  };

  const onMarkQueued = async () => {
    const map = await loadSubmissions();
    let next = map;
    for (const row of rows) for (const platformId of Array.from(enabled)) next = setStatus(next, row.id, platformId, 'queued');
    await saveSubmissions(next);
    toast.success(`Queued ${rows.length} file(s)`, `Marked queued on ${enabled.size} platform(s) — track them in the Submission planner.`);
  };

  const onRenameAll = async () => {
    setBusy(true);
    let changed = 0;
    for (const row of rows) {
      const safe = sanitizeFilename(row.name);
      if (safe.changed && (await library.renameItem(row.id, safe.name))) changed++;
    }
    setBusy(false);
    toast.success(`Renamed ${changed} file${changed === 1 ? '' : 's'}`, 'CSV filename matching is case- and character-sensitive on every platform.');
  };

  return (
    <>
      <PageHeader
        title="Export centre"
        description="Per-platform CSV, renames, embedding"
        actions={
          <>
            <Button size="sm" variant="outline" loading={busy} icon={<PenLine className="size-4" />} onClick={onEmbedAll} disabled={rows.length === 0}>
              Embed all
            </Button>
            <Button size="sm" variant="outline" loading={busy} icon={<FileSpreadsheet className="size-4" />} onClick={onRenameAll} disabled={rows.length === 0}>
              Rename safe
            </Button>
            <Button size="sm" variant="ghost" loading={busy} icon={<Send className="size-4" />} onClick={onMarkQueued} disabled={rows.length === 0 || enabled.size === 0}>
              Mark queued
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" dot>{rows.length} row{rows.length === 1 ? '' : 's'}</Badge>
          <Button size="xs" variant={scope === 'selection' ? 'primary' : 'outline'} onClick={() => setScope('selection')} disabled={library.selection.size === 0}>
            Selection ({library.selection.size})
          </Button>
          <Button size="xs" variant={scope === 'all' ? 'primary' : 'outline'} onClick={() => setScope('all')}>
            Whole library ({library.items.length})
          </Button>
        </div>
      </PageHeader>

      <Card title="Platforms" flush>
        <div className="flex flex-wrap gap-2 p-4">
          {PLATFORM_LIST.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => toggle(platform.id)}
              className={
                enabled.has(platform.id)
                  ? 'inline-flex items-center gap-2 rounded-[0.375rem] border border-brand bg-brand-soft px-2.5 py-1 text-[0.75rem] font-semibold text-brand-fg'
                  : 'inline-flex items-center gap-2 rounded-[0.375rem] border border-line bg-surface-2 px-2.5 py-1 text-[0.75rem] font-medium text-fg-muted transition-colors hover:text-fg'
              }
            >
              <PlatformLogo id={platform.id} size={18} />
              {platform.name}
              {platform.csv ? null : <Badge tone="neutral">sheet</Badge>}
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="mt-4">
          <p className="p-6 text-center text-sm text-fg-muted">Import files in the Library first — exports need at least one row.</p>
        </Card>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 xl:grid-cols-2">
          {exports.map(({ platform, result, blocking }) => (
            <Card
              key={platform.id}
              title={
                <span className="flex items-center gap-2">
                  <PlatformLogo id={platform.id} size={20} />
                  {platform.name}
                </span>
              }
              description={platform.csv ? platform.csv.notes : 'No CSV importer — copy-paste sheet'}
              action={
                <span className="flex items-center gap-1.5">
                  <Badge tone="neutral">{platform.csv ? `${platform.csv.delimiter === ';' ? 'semicolon' : 'comma'} CSV` : 'copy sheet'}</Badge>
                  {blocking.length > 0 && <Badge tone="danger" dot>{blocking.length} blocking</Badge>}
                </span>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" icon={<Download className="size-4" />} onClick={() => download(result.filename, result.content)}>
                  Download {result.filename}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="size-4" />}
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.content);
                    toast.success('CSV copied to clipboard');
                  }}
                >
                  Copy
                </Button>
                <span className="text-[0.6875rem] text-fg-subtle tabular-nums">{result.rows} rows · {(result.bytes / 1024).toFixed(1)} KB</span>
              </div>

              {result.warnings.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-1.5 rounded-md bg-warn-soft px-2 py-1.5 text-[0.6875rem] text-warn">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {warning}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3">
                <CodeBlock code={result.content.split('\r\n').slice(0, 5).join('\n') || '(empty)'} language="csv" maxHeight="10rem" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        Exports are UTF-8 with BOM so Excel opens them without mangling accents. Filename matching on every platform is
        exact and case-sensitive — use “Rename safe” after any rename outside this app.
      </p>
    </>
  );
}
