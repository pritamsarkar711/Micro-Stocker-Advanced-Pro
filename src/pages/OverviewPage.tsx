import { useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Kpi } from '@/components/ui/Kpi';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { PlatformLogo } from '@/components/stock/PlatformLogo';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import { buildValidationIndex, validateItem, worstLevel } from '@/lib/stock/validate';
import type { PlatformId } from '@/lib/stock/types';

const STUDIO_TOOLS: Array<{
  to: string;
  title: string;
  sub: string;
  icon: GoogleIconName;
}> = [
  {
    to: '/vector',
    title: 'Vector Studio',
    sub: 'Draw, open and export SVG or EPS',
    icon: 'polyline',
  },
  {
    to: '/quality',
    title: 'Quality Checker',
    sub: 'Editability, sharpness and duplicates',
    icon: 'fact_check',
  },
  {
    to: '/optimize',
    title: 'Image Optimizer',
    sub: 'Smaller files, same visible quality',
    icon: 'compress',
  },
  {
    to: '/upscale',
    title: 'Image Upscaler',
    sub: 'Local models up to 8K',
    icon: 'photo_size_select_large',
  },
  {
    to: '/bg-remove',
    title: 'Background Remover',
    sub: 'Transparent PNG cutouts',
    icon: 'content_cut',
  },
  {
    to: '/convert',
    title: 'Image Converter',
    sub: 'JPG, PNG, WebP, AVIF, TIFF, EPS',
    icon: 'swap_horiz',
  },
];

const GENERATORS: Array<{ to: string; title: string; sub: string; icon: GoogleIconName }> = [
  { to: '/generate/eps', title: 'AI EPS', sub: 'Editable vector', icon: 'polyline' },
  { to: '/generate/svg', title: 'AI SVG', sub: 'Layered vector', icon: 'draw' },
  { to: '/generate/ai', title: 'Illustrator', sub: 'AI file', icon: 'layers' },
  { to: '/generate/jpg', title: 'JPG image', sub: 'Photo style', icon: 'image' },
];

const FEATURED_PLATFORMS: PlatformId[] = [
  'shutterstock',
  'adobe',
  'freepik',
  'getty',
  'dreamstime',
  '123rf',
  'depositphotos',
  'vecteezy',
  'alamy',
  'pond5',
  'canva',
  'envato',
];

export function OverviewPage() {
  const { items, importFiles } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const titled = items.filter(
      (it) => it.metadata.title.trim() && it.metadata.keywords.length >= 7,
    ).length;
    const embedded = items.filter((it) => Boolean(it.embeddedAt)).length;
    const avgKeywords = items.length
      ? Math.round(items.reduce((sum, it) => sum + it.metadata.keywords.length, 0) / items.length)
      : 0;
    return { total: items.length, titled, embedded, avgKeywords };
  }, [items]);

  const readiness = useMemo(() => {
    const idx = buildValidationIndex(items);
    return FEATURED_PLATFORMS.map((id) => {
      const p = PLATFORM_LIST.find((x) => x.id === id)!;
      if (!items.length) return { platform: p, ready: 0 };
      let ready = 0;
      for (const it of items) {
        if (worstLevel(validateItem(it, id, items, idx)) !== 'error') ready++;
      }
      return { platform: p, ready };
    });
  }, [items]);

  /** One clear next action, derived from what the library already contains. */
  const nextStep = useMemo(() => {
    if (!items.length) {
      return {
        title: 'Start with your first asset',
        body: 'Import a photo or vector. Everything else in the studio builds on the library.',
        action: 'Import files',
        to: null as string | null,
      };
    }
    const untagged = items.filter((it) => !it.metadata.title.trim() || it.metadata.keywords.length < 7).length;
    if (untagged) {
      return {
        title: `Finish metadata for ${untagged} file${untagged === 1 ? '' : 's'}`,
        body: 'Titles and keywords decide whether buyers ever see the file. Batch generate, then review.',
        action: 'Open Library',
        to: '/library',
      };
    }
    const notEmbedded = items.filter((it) => !it.embeddedAt).length;
    if (notEmbedded) {
      return {
        title: `Embed metadata in ${notEmbedded} file${notEmbedded === 1 ? '' : 's'}`,
        body: 'Portal uploads read embedded IPTC and XMP. Embed once, then export.',
        action: 'Open Export',
        to: '/export',
      };
    }
    return {
      title: 'Everything is ready to submit',
      body: 'Assets are tagged and embedded. Queue them on the portals you sell on.',
      action: 'Open Planner',
      to: '/planner',
    };
  }, [items]);

  async function handleQuickImport(files: FileList) {
    const added = await importFiles(files);
    if (added.length) {
      toast.success(`Imported ${added.length} file${added.length === 1 ? '' : 's'}`);
      navigate('/library');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.eps,.ai,.svg,.tif,.tiff,.avif,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleQuickImport(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              icon={<GIcon name="upload_file" size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Import files
            </Button>
            <ButtonLink
              to="/library"
              size="sm"
              variant="primary"
              className="w-full sm:w-auto"
              icon={<GIcon name="photo_library" size={16} />}
            >
              Open Library
            </ButtonLink>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi label="Library Assets" value={String(stats.total)} icon="photo_library" />
        <Kpi label="Tagged & Ready" value={String(stats.titled)} icon="check_circle" />
        <Kpi label="Embedded" value={String(stats.embedded)} icon="bookmark" />
        <Kpi label="Keywords avg" value={String(stats.avgKeywords)} icon="local_offer" />
      </div>

      <Card padding="sm" className="border-brand/25 bg-brand-soft/40">
        <div className="flex items-start gap-3 sm:items-center">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-brand text-on-brand">
            <GIcon name="tune" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{nextStep.title}</div>
            <div className="text-xs leading-relaxed text-ink-muted">{nextStep.body}</div>
          </div>
          <div className="hidden shrink-0 sm:block">
            {nextStep.to ? (
              <ButtonLink to={nextStep.to} size="sm" variant="secondary">
                {nextStep.action}
              </ButtonLink>
            ) : (
              <Button size="sm" variant="secondary" icon={<GIcon name="upload_file" size={15} />} onClick={() => fileRef.current?.click()}>
                {nextStep.action}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2.5 sm:hidden">
          {nextStep.to ? (
            <ButtonLink to={nextStep.to} size="sm" variant="secondary" block>
              {nextStep.action}
            </ButtonLink>
          ) : (
            <Button size="sm" variant="secondary" block icon={<GIcon name="upload_file" size={15} />} onClick={() => fileRef.current?.click()}>
              {nextStep.action}
            </Button>
          )}
        </div>
      </Card>

      <div>
        <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">Create with AI</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {GENERATORS.map((tool) => (
            <Link key={tool.to} to={tool.to} className="min-w-0">
              <div className="flex h-full flex-col gap-2 rounded-[var(--r-card)] border border-brand/20 bg-brand-soft/45 p-3 active:brightness-95 sm:p-3.5">
                <span className="inline-flex size-9 items-center justify-center rounded-[var(--r-control)] bg-brand text-on-brand">
                  <GIcon name={tool.icon} size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-bold text-ink">{tool.title}</span>
                  <span className="block truncate text-2xs text-ink-muted">{tool.sub}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Studio Tools
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {STUDIO_TOOLS.map((tool) => (
            <Link key={tool.to} to={tool.to} className="min-w-0">
              <div className="flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-[var(--r-card)] border border-line bg-surface p-3 active:bg-surface-2 sm:min-h-0 sm:flex-row sm:items-center sm:gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-accent-soft text-accent sm:size-10">
                  <GIcon name={tool.icon} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.8125rem] leading-tight font-semibold text-ink sm:truncate sm:text-sm">{tool.title}</div>
                  <div className="hidden truncate text-xs text-ink-muted sm:block">{tool.sub}</div>
                </div>
                <GIcon name="chevron_right" size={16} className="hidden shrink-0 text-ink-faint sm:block" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader
          title="Marketplace Readiness"
          icon={<GIcon name="storefront" size={17} />}
          action={
            <ButtonLink to="/platforms" size="xs" variant="ghost" iconRight={<GIcon name="arrow_forward" size={13} />}>
              All rules
            </ButtonLink>
          }
        />

        <div className="divide-y divide-line overflow-hidden rounded-[var(--r-control)] border border-line bg-surface sm:grid sm:grid-cols-2 sm:gap-2.5 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent lg:grid-cols-3">
          {readiness.map(({ platform, ready }) => (
            <Link
              key={platform.id}
              to="/export"
              className="flex items-center gap-3 px-3 py-2.5 active:bg-surface-2 sm:rounded-[var(--r-control)] sm:border sm:border-line sm:bg-surface sm:p-3 sm:hover:border-line-strong sm:hover:bg-surface-2/50"
            >
              <PlatformLogo id={platform.id} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[0.8125rem] leading-snug font-semibold text-ink">{platform.name}</div>
                <div className="mt-0.5 truncate text-2xs text-ink-muted">
                  {platform.minMP > 0 ? `${platform.minMP} MP min` : 'Vector'} · {platform.keywords.min} to {platform.keywords.max} tags
                </div>
              </div>
              <Badge tone={ready > 0 && ready === items.length ? 'brand' : 'neutral'}>
                {items.length ? `${ready}/${items.length}` : platform.csv ? 'CSV' : 'XMP'}
              </Badge>
              <GIcon name="chevron_right" size={16} className="text-ink-faint sm:hidden" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
