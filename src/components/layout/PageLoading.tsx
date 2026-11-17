import { Spinner } from '@/components/ui/Misc';

export function PageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="inline-flex items-center gap-2.5 text-[0.8125rem] font-medium text-ink-muted">
        <Spinner size={18} />
        <span>{label}</span>
      </div>
    </div>
  );
}
