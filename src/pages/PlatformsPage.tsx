import { ExternalLink, FileSpreadsheet, ScanEye, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { desktop } from '@/lib/desktop';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { AGGREGATORS, PLATFORM_LIST } from '@/lib/stock/platforms';

export function PlatformsPage() {
  return (
    <>
      <PageHeader
        title="Platform requirements"
        description="The rules every validator and CSV writer enforces."
      >
        <div className="flex flex-wrap gap-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-xs leading-relaxed text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Compiled November 2026 from official contributor docs. Platforms change limits without notice — the app warns, it never blocks an export.
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {PLATFORM_LIST.map((platform) => (
          <Card
            key={platform.id}
            title={
              <span className="flex items-center gap-2">
                <PlatformLogo id={platform.id} size={24} />
                {platform.name}
              </span>
            }
            description={platform.site}
            action={
              <Badge tone={platform.source === 'official' ? 'ok' : platform.source === 'official+community' ? 'brand' : 'neutral'}>
                {platform.source}
              </Badge>
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Row label="Raster formats" value={platform.formats.photo.map((f) => f.toUpperCase()).join(', ') || '—'} />
              <Row label="Vector formats" value={platform.formats.vector.map((f) => f.toUpperCase()).join(', ') || 'none'} />
              <Row label="Resolution" value={`${platform.minMP}${platform.maxMP ? `-${platform.maxMP}` : '+'} MP`} />
              <Row label="Max file" value={`${platform.maxFileMB} MB`} />
              <Row label="Keywords" value={`${platform.keywords.min}-${platform.keywords.max}${platform.keywords.ordered ? ' (ordered)' : ''}`} />
              <Row label="Sweet spot" value={`${platform.keywords.sweetSpot[0]}-${platform.keywords.sweetSpot[1]} keywords`} />
              <Row label="Title cap" value={`${platform.title.maxChars} chars${platform.title.noCommas ? ', no commas' : ''}`} />
              <Row label="Description" value={`≤ ${platform.description.maxChars} chars${platform.description.minWords ? `, ≥ ${platform.description.minWords} words` : ''}`} />
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {platform.csv ? (
                <Badge tone="brand" icon={<FileSpreadsheet className="size-3" />}>
                  CSV: {platform.csv.delimiter === ';' ? 'semicolon, no header' : 'comma + header'}
                </Badge>
              ) : (
                <Badge tone="neutral" icon={<FileSpreadsheet className="size-3" />}>no CSV — copy sheet</Badge>
              )}
              {platform.readsEmbeddedMetadata ? (
                <Badge tone="ok" icon={<ScanEye className="size-3" />}>reads IPTC/XMP</Badge>
              ) : (
                <Badge tone="neutral" icon={<ScanEye className="size-3" />}>portal-only metadata</Badge>
              )}
              {platform.aiPolicy === 'forbidden' ? (
                <Badge tone="danger" icon={<ShieldCheck className="size-3" />}>AI forbidden</Badge>
              ) : (
                <Badge tone="warn" icon={<ShieldCheck className="size-3" />}>AI with disclosure</Badge>
              )}
            </div>

            <p className="mt-3 text-[0.6875rem] leading-relaxed text-fg-muted"><strong className="text-fg">Vectors:</strong> {platform.vectorRules}</p>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-fg-muted"><strong className="text-fg">Filenames:</strong> {platform.filenameRules}</p>
            {platform.csv && <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-fg-muted"><strong className="text-fg">CSV:</strong> {platform.csv.notes}</p>}
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-fg-muted"><strong className="text-fg">AI policy:</strong> {platform.aiNote}</p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="flex flex-wrap gap-1">
                {platform.highlights.map((h) => (
                  <Badge key={h} tone="outline">{h}</Badge>
                ))}
              </span>
              <Button size="xs" variant="ghost" icon={<ExternalLink className="size-3.5" />} onClick={() => desktop.shell.openExternal(platform.site)}>
                Open
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4" title="Aggregators & multi-agency workflow" description="Where the per-platform exports fit">
        <ul className="flex flex-col gap-3">
          {AGGREGATORS.map((aggregator) => (
            <li key={aggregator.name} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-sm font-medium text-fg">{aggregator.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{aggregator.note}</p>
            </li>
          ))}
          <li className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-sm font-medium text-fg">Recommended order of operations</p>
            <ol className="mt-1.5 list-inside list-decimal text-xs leading-relaxed text-fg-muted">
              <li>Import → app reads any existing IPTC/XMP automatically.</li>
              <li>Upscale anything below a platform minimum (Upscale studio, per-platform preset).</li>
              <li>Generate metadata once; adapt per platform at export time.</li>
              <li>Embed IPTC/XMP so portals pre-fill (Adobe, Shutterstock, Dreamstime, 123RF, Depositphotos, Getty, Alamy).</li>
              <li>Export each platform's CSV with exact dialect; rename files to platform-safe names.</li>
              <li>Attach model/property releases in each portal — the app tracks the flags, portals store the PDFs.</li>
            </ol>
          </li>
        </ul>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] tracking-wide text-fg-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-fg" title={value}>{value}</dd>
    </div>
  );
}
