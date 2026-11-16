import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useToast } from '@/state/ToastState';

interface SeasonalEvent {
  title: string;
  month: number; // 1..12
  leadWeeks: number;
  keywords: string[];
}

const SEASONAL_EVENTS: SeasonalEvent[] = [
  { title: 'New Year & Goals', month: 1, leadWeeks: 8, keywords: ['new year', 'celebration', 'goals', 'planning', 'calendar', 'minimal'] },
  { title: 'Lunar New Year', month: 2, leadWeeks: 8, keywords: ['lunar new year', 'lantern', 'red gold', 'festival', 'prosperity', 'tradition'] },
  { title: 'Valentines Day', month: 2, leadWeeks: 8, keywords: ['valentine', 'love', 'heart', 'romance', 'gift', 'couple', 'flowers'] },
  { title: 'Ramadan & Eid', month: 3, leadWeeks: 8, keywords: ['ramadan', 'eid', 'crescent', 'lantern', 'iftar', 'islamic', 'greeting'] },
  { title: 'Womens Day', month: 3, leadWeeks: 6, keywords: ['empowerment', 'leadership', 'women', 'equality', 'portrait', 'community'] },
  { title: 'Earth Day & Sustainability', month: 4, leadWeeks: 7, keywords: ['sustainability', 'renewable energy', 'ecology', 'green', 'nature', 'recycling'] },
  { title: 'Mothers & Fathers Day', month: 5, leadWeeks: 7, keywords: ['family', 'gratitude', 'gift', 'greeting card', 'parent', 'warm light'] },
  { title: 'Summer Travel & Vacation', month: 7, leadWeeks: 9, keywords: ['summer', 'beach', 'travel', 'tropical', 'holiday', 'sunshine', 'leisure'] },
  { title: 'Back to School', month: 8, leadWeeks: 8, keywords: ['education', 'school', 'learning', 'notebook', 'student', 'study', 'classroom'] },
  { title: 'Autumn & Harvest', month: 10, leadWeeks: 8, keywords: ['autumn', 'foliage', 'cozy', 'pumpkin', 'warm tones', 'harvest', 'october'] },
  { title: 'Diwali Festival of Lights', month: 11, leadWeeks: 8, keywords: ['diwali', 'diya', 'rangoli', 'festival', 'lights', 'celebration', 'gold'] },
  { title: 'Black Friday & Ecommerce', month: 11, leadWeeks: 7, keywords: ['sale', 'shopping', 'retail', 'discount', 'packaging', 'banner', 'ecommerce'] },
  { title: 'Winter Holidays & Christmas', month: 12, leadWeeks: 10, keywords: ['christmas', 'winter', 'holiday', 'festive', 'gift', 'snow', 'ornament'] },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PlannerPage() {
  const toast = useToast();
  const currentMonth = new Date().getMonth() + 1;

  const ordered = useMemo(() => {
    return SEASONAL_EVENTS.map((ev) => {
      const monthsAhead = (ev.month - currentMonth + 12) % 12;
      const uploadNow = monthsAhead >= 1 && monthsAhead <= 3;
      return { ...ev, monthsAhead, uploadNow };
    }).sort((a, b) => a.monthsAhead - b.monthsAhead);
  }, [currentMonth]);

  async function copyTags(ev: SeasonalEvent) {
    try {
      await navigator.clipboard.writeText(ev.keywords.join(', '));
      toast.success(`Copied ${ev.title} tags`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Seasonal Planner" />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((ev) => (
          <Card key={ev.title} className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={ev.uploadNow ? 'brand' : 'neutral'}>
                  <GIcon name="calendar_month" size={12} />
                  {MONTHS[ev.month - 1]}
                </Badge>
                {ev.uploadNow && <Badge tone="brand">Upload window open</Badge>}
              </div>
              <h2 className="mt-2 text-sm font-bold text-ink">{ev.title}</h2>
              <div className="mt-0.5 text-2xs text-ink-muted">
                Submit {ev.leadWeeks} weeks ahead of peak buyer search
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {ev.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-[var(--r-xs)] border border-line bg-surface-2 px-2 py-0.5 text-2xs text-ink"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-line pt-2.5">
              <Button
                size="xs"
                variant="secondary"
                icon={<GIcon name="content_copy" size={13} />}
                onClick={() => void copyTags(ev)}
              >
                Copy tags
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
