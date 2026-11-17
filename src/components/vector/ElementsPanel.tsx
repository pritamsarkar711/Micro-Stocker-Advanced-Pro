import { memo, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ELEMENTS, ELEMENT_GROUPS, TEMPLATES, type VectorElement } from '@/lib/vector/library';
import { StudioIcon } from '@/components/vector/StudioIcon';

/** Insertable library artwork with search, category filters and starting templates. */
export const ElementsPanel = memo(function ElementsPanel({
  active,
  onCategory,
  onInsert,
  onTemplate,
}: {
  active: string;
  onCategory: (id: string) => void;
  onInsert: (element: VectorElement) => void;
  onTemplate: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();

  const groups = useMemo(() => {
    if (term) {
      const hits = ELEMENTS.filter(
        (element) => element.name.toLowerCase().includes(term) || element.id.includes(term),
      );
      return [{ category: { id: 'search', label: 'Results' }, items: hits }];
    }
    return active === 'all'
      ? [{ category: { id: 'all', label: 'All' }, items: ELEMENTS }]
      : ELEMENT_GROUPS.filter((group) => group.category.id === active);
  }, [active, term]);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="elements-panel">
      <div className="border-b border-line px-2 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 rounded-[var(--r-control)] border border-line px-1.5">
          <StudioIcon name="search" size={12} className="text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library"
            aria-label="Search library"
            className="h-6 min-w-0 flex-1 bg-transparent text-2xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-ink-faint hover:text-ink" aria-label="Clear search">
              <StudioIcon name="close" size={10} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {TEMPLATES.slice(0, 6).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onTemplate(template.id)}
              className="group flex flex-col gap-1 rounded-[var(--r-control)] border border-line bg-surface p-1 text-left transition-colors hover:border-brand"
              title={template.name}
            >
              <span className="checkerboard flex h-10 w-full items-center justify-center overflow-hidden rounded-[var(--r-xs)]">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(template.svg)}`}
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                  loading="lazy"
                />
              </span>
              <span className="truncate text-2xs text-ink-muted group-hover:text-ink">{template.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-2xs text-ink-faint">
          {ELEMENTS.length} elements
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => onCategory('all')}
          className={clsx(
            'rounded-[var(--r-xs)] px-1.5 py-0.5 text-2xs font-medium transition-colors',
            active === 'all' && !term ? 'bg-brand-solid text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          All
        </button>
        {ELEMENT_GROUPS.map((group) => (
          <button
            key={group.category.id}
            type="button"
            onClick={() => onCategory(group.category.id)}
            className={clsx(
              'rounded-[var(--r-xs)] px-1.5 py-0.5 text-2xs font-medium transition-colors',
              active === group.category.id && !term ? 'bg-brand-solid text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {group.category.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {term && !total && <div className="px-1 py-4 text-center text-2xs text-ink-faint">No match</div>}
        {groups.map((group) => (
          <div key={group.category.id} className="mb-3">
            {!term && active === 'all' && (
              <div className="mb-1 flex items-center justify-between text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
                <span>{group.category.label}</span>
                <span className="tabular-nums">{group.items.length}</span>
              </div>
            )}
            <div className="grid grid-cols-4 gap-1">
              {group.items.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => onInsert(element)}
                  title={element.name}
                  aria-label={element.name}
                  className="group flex flex-col items-center gap-0.5 rounded-[var(--r-control)] p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <span className="checkerboard flex h-9 w-full items-center justify-center overflow-hidden rounded-[var(--r-xs)] border border-line/70">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-7 w-7"
                      fill={element.mode === 'stroke' ? 'none' : 'currentColor'}
                      stroke={element.mode === 'stroke' ? 'currentColor' : 'none'}
                      strokeWidth={element.mode === 'stroke' ? (element.strokeWidth ?? 6) : 0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: element.body }}
                    />
                  </span>
                  <span className="w-full truncate text-center text-2xs leading-tight">{element.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
