import { Skeleton } from '@/components/ui/Misc';

/**
 * Shown while a lazily-loaded page chunk is fetching. Mirrors the page header
 * + card grid rhythm so the layout does not jump when the real page mounts.
 */
export function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-[110rem] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-2">
        <span className="sr-only">Loading page…</span>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-md" />
      </div>
    </div>
  );
}
