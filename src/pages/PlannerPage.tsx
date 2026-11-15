import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleDashed, ListChecks, Send, TriangleAlert, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/Misc';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';
import { PLATFORM_LIST } from '@/lib/stock/platforms';
import type { PlatformId } from '@/lib/stock/types';
import { validateItem } from '@/lib/stock/validate';
import {
  countByStatus, loadSubmissions, PLATFORM_CAPS, saveSubmissions, setStatus, statusOf,
  STATUS_ORDER, STATUS_TONE, type SubmissionMap, type SubmissionStatus,
} from '@/lib/stock/submissions';

const STATUS_ICON: Record<SubmissionStatus, typeof CircleDashed> = {
  todo: CircleDashed,
  queued: ListChecks,
  submitted: Send,
  accepted: CheckCircle2,
  rejected: XCircle,
};

export function PlannerPage() {
  const library = useLibrary();
  const toast = useToast();
  const [platform, setPlatform] = useState<PlatformId>('freepik');
  const [map, setMap] = useState<SubmissionMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSubmissions().then((stored) => {
      setMap(stored);
      setReady(true);
    });
  }, []);

  const update = (next: SubmissionMap) => {
    setMap(next);
    void saveSubmissions(next);
  };

  const spec = PLATFORM_LIST.find((p) => p.id === platform)!;
  const cap = PLATFORM_CAPS[platform];

  const rows = useMemo(
    () =>
      library.items.map((item) => ({
        item,
        status: statusOf(map, item.id, platform),
        errors: validateItem(item, platform, library.items).filter((i) => i.level === 'error').length,
      })),
    [library.items, map, platform],
  );

  const counts = countByStatus(map, platform);
  const submittedCount = counts.submitted + counts.accepted;
  const eligible = rows.filter((r) => r.errors === 0);

  const firstBatchIssue =
    cap?.firstBatch && submittedCount === 0 && library.items.length > 0
      ? library.items.length < cap.firstBatch[0]
        ? `First ${spec.name} submission needs ${cap.firstBatch[0]}-${cap.firstBatch[1]} files of ONE format — you have ${library.items.length}. Keep producing until you reach the window; the submit button stays disabled below it.`
        : library.items.length > cap.firstBatch[1]
          ? `First batch cap is ${cap.firstBatch[1]} files — select exactly ${cap.firstBatch[1]} (same format) and queue them, leave the rest for next month.`
          : `You are inside the first-batch window (${cap.firstBatch[0]}-${cap.firstBatch[1]}). Queue all ${library.items.length} files of one format and submit together.`
      : null;

  const monthlyIssue =
    cap?.monthly && submittedCount > cap.monthly
      ? `Monthly cap exceeded: ${submittedCount}/${cap.monthly} submitted this cycle — the portal will refuse extras until reset.`
      : cap?.monthly
        ? `${submittedCount}/${cap.monthly} of the monthly quota used on ${spec.name}.`
        : null;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'File',
      primary: true,
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.item.thumbUrl ? <img src={row.item.thumbUrl} alt="" className="size-8 shrink-0 rounded-md border border-line object-cover" /> : <span className="size-8 shrink-0 rounded-md border border-line bg-surface-2" />}
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{row.item.name}</span>
            <span className="block truncate text-[0.625rem] text-fg-subtle">{row.item.metadata.title || 'no title'}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'errors',
      header: 'Validation',
      hideBelow: 'md',
      render: (row) =>
        row.errors ? (
          <Badge tone="danger" icon={<TriangleAlert className="size-3" />}>{row.errors} blocker{row.errors === 1 ? '' : 's'}</Badge>
        ) : (
          <Badge tone="ok" dot>eligible</Badge>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'sm',
      render: (row) => {
        const Icon = STATUS_ICON[row.status];
        return (
          <Badge tone={STATUS_TONE[row.status]} icon={<Icon className="size-3" />}>
            {row.status}
            {map[row.item.id]?.[platform]?.at ? ` · ${new Date(map[row.item.id]![platform]!.at).toLocaleDateString()}` : ''}
          </Badge>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <Select
          value={row.status}
          className="h-8 w-32 text-xs"
          onChange={(event) => update(setStatus(map, row.item.id, platform, event.target.value as SubmissionStatus))}
          options={STATUS_ORDER.map((status) => ({ value: status, label: status }))}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Submission planner"
        description="Per-platform queues with real publishing caps: mark files todo → queued → submitted → accepted/rejected, and see first-batch / monthly limits before the portal refuses your batch."
        actions={
          <Select
            value={platform}
            onChange={(event) => setPlatform(event.target.value as PlatformId)}
            className="w-56"
            options={PLATFORM_LIST.map((p) => ({ value: p.id, label: p.name }))}
          />
        }
      >
        <div className="grid-auto-fit gap-3">
          {STATUS_ORDER.map((status) => {
            const StatusIcon = STATUS_ICON[status];
            return (
              <div key={status} className="card flex items-center gap-3 p-3.5">
                <Badge tone={STATUS_TONE[status]} icon={<StatusIcon className="size-3" />}>{status}</Badge>
                <p className="ml-auto text-xl font-semibold text-fg tabular-nums">{counts[status]}</p>
              </div>
            );
          })}
        </div>
      </PageHeader>

      {(firstBatchIssue || monthlyIssue || cap) && (
        <Card className="mb-4" title={`${spec.name} publishing caps`} action={<CalendarClock className="size-4 text-brand" />}>
          {cap && <p className="text-xs leading-relaxed text-fg-muted">{cap.note}</p>}
          {firstBatchIssue && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {firstBatchIssue}
            </p>
          )}
          {monthlyIssue && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
              <CalendarClock className="mt-0.5 size-4 shrink-0" /> {monthlyIssue}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                let next = map;
                for (const row of eligible) if (statusOf(next, row.item.id, platform) === 'todo') next = setStatus(next, row.item.id, platform, 'queued');
                update(next);
                toast.success('Eligible files queued', `${eligible.length} validation-clean file(s) marked queued for ${spec.name}.`);
              }}
            >
              Queue all eligible ({eligible.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                let next = map;
                for (const row of rows) if (statusOf(next, row.item.id, platform) === 'queued') next = setStatus(next, row.item.id, platform, 'submitted');
                update(next);
                toast.info('Marked submitted', 'Update to accepted/rejected once review finishes.');
              }}
            >
              Queued → submitted
            </Button>
          </div>
        </Card>
      )}

      <Card flush>
        {!ready ? (
          <p className="p-6 text-center text-sm text-fg-muted">Loading planner…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<ListChecks className="size-7" />} title="Nothing in the library" description="Import files first — the planner tracks their journey per platform." />
        ) : (
          <DataTable rows={rows} columns={columns} rowKey={(row) => row.item.id} dense footer={`${eligible.length} of ${rows.length} files currently pass ${spec.name} validation.`} />
        )}
      </Card>
    </>
  );
}
