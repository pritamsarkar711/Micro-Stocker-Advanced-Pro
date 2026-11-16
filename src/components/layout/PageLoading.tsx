import { Spinner } from '@/components/ui/Misc';

export function PageLoading() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="inline-flex items-center gap-2.5 text-xs font-medium text-ink-muted">
        <Spinner size={16} />
        <span>Loading</span>
      </div>
    </div>
  );
}
