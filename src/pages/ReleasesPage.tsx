import { useState } from 'react';
import { CalendarX2, FileSignature, Landmark, Plus, Trash2, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/Misc';
import { isExpired, useReleases, type Release } from '@/state/releases';
import { useLibrary } from '@/state/library';
import { useToast } from '@/state/ToastState';

const EMPTY_FORM = { kind: 'model' as Release['kind'], name: '', signedAt: '', expiresAt: '', notes: '', fileName: '' };

export function ReleasesPage() {
  const { releases, addRelease, updateRelease, deleteRelease } = useReleases();
  const library = useLibrary();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const linkedCount = (id: string) => library.items.filter((item) => (item.releaseIds ?? []).includes(id)).length;

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (release: Release) => {
    setEditing(release);
    setForm({ kind: release.kind, name: release.name, signedAt: release.signedAt, expiresAt: release.expiresAt, notes: release.notes, fileName: release.fileName });
    setOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Name required', 'Who signed (model) or what is cleared (property)?');
      return;
    }
    if (editing) updateRelease(editing.id, form);
    else addRelease(form);
    setOpen(false);
    toast.success(editing ? 'Release updated' : 'Release added', 'Link it to items from the item editor.');
  };

  const columns: Column<Release>[] = [
    {
      key: 'name',
      header: 'Name / property',
      primary: true,
      render: (row) => (
        <span className="flex items-center gap-2">
          {row.kind === 'model' ? <UserCheck className="size-4 shrink-0 text-brand" /> : <Landmark className="size-4 shrink-0 text-warn" />}
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{row.name}</span>
            {row.fileName && <span className="block truncate text-[0.625rem] text-fg-subtle">{row.fileName}</span>}
          </span>
        </span>
      ),
    },
    { key: 'kind', header: 'Kind', hideBelow: 'sm', render: (row) => <Badge tone={row.kind === 'model' ? 'brand' : 'warn'}>{row.kind}</Badge> },
    { key: 'signedAt', header: 'Signed', hideBelow: 'md', sortable: true, render: (row) => <span className="tabular-nums">{row.signedAt || '—'}</span> },
    {
      key: 'expiresAt',
      header: 'Validity',
      hideBelow: 'lg',
      render: (row) =>
        isExpired(row) ? (
          <Badge tone="danger" icon={<CalendarX2 className="size-3" />}>expired {row.expiresAt}</Badge>
        ) : row.expiresAt ? (
          <Badge tone="warn">until {row.expiresAt}</Badge>
        ) : (
          <Badge tone="ok">no expiry</Badge>
        ),
    },
    { key: 'links', header: 'Items', align: 'right', hideBelow: 'md', render: (row) => <span className="tabular-nums">{linkedCount(row.id)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <span className="flex justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="xs" variant="ghost" icon={<Trash2 className="size-3.5" />} aria-label="Delete release" onClick={() => { deleteRelease(row.id); toast.info('Release deleted', 'Items keep working; the release warning returns.'); }} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Releases"
        description="Model & property releases: who is cleared, expiry, and the files they cover."
        actions={<Button size="sm" icon={<Plus className="size-4" />} onClick={openNew}>Add release</Button>}
      />

      <Card flush>
        {releases.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="size-7" />}
            title="No releases registered"
            description="Add one per recognisable person or private property that appears in your commercial content. Editorial content never needs releases."
            action={<Button icon={<Plus className="size-4" />} onClick={openNew}>Add release</Button>}
          />
        ) : (
          <DataTable rows={releases} columns={columns} rowKey={(row) => row.id} dense />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit release' : 'Add release'}
        description="Signed forms must use each portal's own template when you upload; this registry is your memory."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} icon={<FileSignature className="size-4" />}>{editing ? 'Save' : 'Add'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Kind">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Release['kind'] })} options={[
              { value: 'model', label: 'Model release (person)' },
              { value: 'property', label: 'Property release (place/thing)' },
            ]} />
          </Field>
          <Field label="Name / property" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahim Uddin (model) or Satkhira studio loft" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Signed on">
              <Input type="date" value={form.signedAt} onChange={(e) => setForm({ ...form, signedAt: e.target.value })} />
            </Field>
            <Field label="Expires (optional)">
              <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </Field>
          </div>
          <Field label="Stored file name (reminder)">
            <Input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="rahim-shutterstock-release.pdf" />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Witnessed signature, ID copy attached…" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
