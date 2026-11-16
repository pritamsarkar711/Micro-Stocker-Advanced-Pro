import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';
import { useToast } from '@/state/ToastState';
import { kv } from '@/lib/kv';
import { getSupabase, isConfigured } from '@/lib/cloud/config';
import { dateTime } from '@/lib/format';

export interface IssueReport {
  id: string;
  category: 'bug' | 'ai' | 'upscale' | 'export' | 'feature' | 'other';
  area: string;
  subject: string;
  details: string;
  contact: string;
  userEmail: string;
  appVersion: string;
  platform: string;
  status: 'submitted' | 'synced';
  createdAt: string;
}

const REPORTS_KEY = 'msap:issue-reports';

const CATEGORIES: Array<{ id: IssueReport['category']; label: string; icon: GoogleIconName }> = [
  { id: 'bug', label: 'Bug', icon: 'bug_report' },
  { id: 'ai', label: 'AI Metadata', icon: 'smart_toy' },
  { id: 'upscale', label: 'Models & Tools', icon: 'memory' },
  { id: 'export', label: 'CSV & XMP', icon: 'upload_file' },
  { id: 'feature', label: 'Feature Idea', icon: 'lightbulb' },
  { id: 'other', label: 'Other', icon: 'chat' },
];

const AREAS = [
  'Library & Metadata Generator',
  'Image Upscaler',
  'Video Upscaler',
  'Background Remover',
  'Image Converter',
  'Export & CSV',
  'Prepare & File Cleanup',
  'Account & Cloud Sync',
  'Settings & Appearance',
];

function makeReportId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
}

export function ReportPage() {
  const { cloud, runtime } = useApp();
  const { user } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState<IssueReport['category']>('bug');
  const [area, setArea] = useState(AREAS[0]);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<IssueReport[]>([]);

  useEffect(() => {
    void kv.get<IssueReport[]>(REPORTS_KEY, []).then((saved) => {
      if (Array.isArray(saved)) setReports(saved);
    });
  }, []);

  useEffect(() => {
    if (user?.email && !contact) setContact(user.email);
  }, [contact, user?.email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !details.trim()) {
      toast.error('Fill in both subject and details');
      return;
    }

    setSubmitting(true);
    try {
      const report: IssueReport = {
        id: makeReportId(),
        category,
        area,
        subject: subject.trim(),
        details: details.trim(),
        contact: contact.trim(),
        userEmail: user?.email ?? '',
        appVersion: runtime.version,
        platform: runtime.platform,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };

      if (isConfigured(cloud)) {
        try {
          const client = await getSupabase(cloud);
          if (client) {
            const { error } = await client.from('issue_reports').insert({
              id: report.id,
              category: report.category,
              area: report.area,
              subject: report.subject,
              details: report.details,
              contact: report.contact,
              user_email: report.userEmail,
              app_version: report.appVersion,
              platform: report.platform,
              status: 'submitted',
              created_at: report.createdAt,
            });
            if (!error) report.status = 'synced';
          }
        } catch {
          /* stored locally */
        }
      }

      const next = [report, ...reports];
      setReports(next);
      await kv.set(REPORTS_KEY, next);
      setSubject('');
      setDetails('');
      toast.success('Report submitted', `Reference #${report.id.slice(0, 8).toUpperCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReport(id: string) {
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    await kv.set(REPORTS_KEY, next);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Report Issue" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="Submit a report" icon={<GIcon name="flag" size={17} />} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-muted">Category</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={clsx(
                      'flex h-9 items-center gap-2 rounded-[var(--r-control)] border px-3 text-xs font-medium',
                      category === c.id
                        ? 'border-accent bg-accent-soft font-semibold text-accent'
                        : 'border-line bg-surface text-ink hover:bg-surface-2',
                    )}
                  >
                    <GIcon name={c.icon} size={15} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Area">
                <Select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  options={AREAS.map((a) => ({ value: a, label: a }))}
                />
              </Field>
              <Field label="Reply email or Telegram ID (optional)">
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="you@example.com or @username"
                />
              </Field>
            </div>

            <Field label="Subject">
              <Input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the problem or request"
              />
            </Field>

            <Field label="Details">
              <Textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened, expected behavior and steps to reproduce"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-2xs text-ink-muted">
                App v{runtime.version} · {runtime.platform.toUpperCase()}
              </span>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                icon={<GIcon name="send" size={15} />}
              >
                Submit report
              </Button>
            </div>
          </form>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title={`Submitted reports (${reports.length})`}
            icon={<GIcon name="history" size={17} />}
          />

          {reports.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">
              No reports submitted yet.
            </div>
          ) : (
            <div className="max-h-[460px] divide-y divide-line overflow-y-auto">
              {reports.map((rep) => (
                <div key={rep.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-ink">{rep.subject}</div>
                      <div className="mt-0.5 text-2xs text-ink-muted">
                        #{rep.id.slice(0, 8).toUpperCase()} · {rep.area} · {dateTime(rep.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone="brand">
                        {rep.status === 'synced' ? 'Synced' : 'Submitted'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => void deleteReport(rep.id)}
                        className="inline-flex size-6 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:text-danger"
                        aria-label="Delete report"
                      >
                        <GIcon name="delete" size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-xs text-ink-muted">{rep.details}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
