import { memo } from 'react';
import clsx from 'clsx';
import { ELEMENTS, ELEMENT_GROUPS, TEMPLATES, type VectorElement } from '@/lib/vector/library';

/** Insertable library artwork with category filters and starting templates. */
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
  const groups = active === 'all' ? [{ category: { id: 'all', label: 'All' }, items: ELEMENTS }] : ELEMENT_GROUPS.filter((group) => group.category.id === active);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-2 py-2">
        <div className="mb-1.5 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Start from</div>
        <div className="grid grid-cols-3 gap-1">
          {TEMPLATES.slice(0, 6).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onTemplate(template.id)}
              className="group flex flex-col gap-1 rounded-[var(--r-control)] border border-line bg-surface p-1 text-left transition-colors hover:border-brand"
              title={`${template.name} · ${template.hint}`}
            >
              <span
                className="checkerboard block w-full overflow-hidden rounded-[var(--r-xs)]"
                style={{ aspectRatio: `${template.width} / ${template.height}`, maxHeight: 46 }}
              >
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(template.svg)}`}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </span>
              <span className="truncate text-2xs text-ink-muted group-hover:text-ink">{template.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => onCategory('all')}
          className={clsx(
            'rounded-[var(--r-xs)] px-1.5 py-0.5 text-2xs font-medium transition-colors',
            active === 'all' ? 'bg-brand-solid text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
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
              active === group.category.id ? 'bg-brand-solid text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {group.category.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.category.id} className="mb-3">
            {active === 'all' && (
              <div className="mb-1 text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">{group.category.label}</div>
            )}
            <div className="grid grid-cols-4 gap-1">
              {group.items.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => onInsert(element)}
                  title={element.name}
                  aria-label={`Add ${element.name}`}
                  className="flex aspect-square items-center justify-center rounded-[var(--r-control)] border border-line bg-surface p-1.5 text-ink-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-fg"
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
                    <g
                      fill={element.mode === 'stroke' ? 'none' : 'currentColor'}
                      stroke={element.mode === 'stroke' ? 'currentColor' : 'none'}
                      strokeWidth={element.mode === 'stroke' ? (element.strokeWidth ?? 4) : 0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: element.body }}
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
