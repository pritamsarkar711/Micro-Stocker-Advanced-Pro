import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/Misc';
import { GIcon } from '@/components/ui/GoogleIcon';
import { isExpired, useReleases } from '@/state/releases';
import { useToast } from '@/state/ToastState';

export function ReleasesPage() {
  const { releases, addRelease, deleteRelease } = useReleases();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'model' | 'property'>('model');
  const [name, setName] = useState('');
  const [signedAt, setSignedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState('');
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addRelease({
      kind,
      name: name.trim(),
      signedAt,
      expiresAt,
      fileName: fileName.trim(),
      notes: notes.trim(),
    });
    setName('');
    setFileName('');
    setNotes('');
    setExpiresAt('');
    setOpen(false);
    toast.success('Release saved');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model & Property Releases"
        actions={
          <Button
            size="sm"
            variant="primary"
            icon={<GIcon name="add" size={16} />}
            onClick={() => setOpen(true)}
            // The empty state carries the same call to action; one is enough.
            className={releases.length === 0 ? 'max-sm:hidden' : undefined}
          >
            Add release
          </Button>
        }
      />

      {releases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GIcon name="assignment_turned_in" size={26} />}
            title="No releases registered"
            description="Track signed model and property releases and link them to Library items and CSV exports."
            action={
              <Button
                size="sm"
                variant="primary"
                icon={<GIcon name="add" size={15} />}
                onClick={() => setOpen(true)}
              >
                Add release
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {releases.map((rel) => {
            const expired = isExpired(rel);
            return (
              <Card key={rel.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{rel.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone="brand">{rel.kind === 'model' ? 'Model' : 'Property'}</Badge>
                      {expired && <Badge tone="danger">Expired</Badge>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRelease(rel.id)}
                    className="inline-flex size-7 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:text-danger"
                    aria-label={`Delete ${rel.name}`}
                  >
                    <GIcon name="delete" size={15} />
                  </button>
                </div>
                <div className="text-xs text-ink-muted">
                  Signed: {rel.signedAt.replace(/-/g, ' ')}
                  {rel.fileName ? ` · ${rel.fileName}` : ''}
                </div>
                {rel.notes && <div className="text-xs text-ink-muted">{rel.notes}</div>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add release" size="sm">
        <form onSubmit={handleCreate} className="space-y-3.5">
          <Field label="Type">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'model' | 'property')}
              options={[
                { value: 'model', label: 'Model release' },
                { value: 'property', label: 'Property release' },
              ]}
            />
          </Field>
          <Field label="Subject or property name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Release identifier"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Signed date">
              <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </Field>
            <Field label="Expiry (optional)">
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Signed PDF filename (optional)">
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="release_signed.pdf"
            />
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save release
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
