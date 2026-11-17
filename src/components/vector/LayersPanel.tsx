import { memo, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { StudioIcon } from '@/components/vector/StudioIcon';
import { ICON_FOR_TAG } from '@/lib/vector/tools';
import type { LayerInfo } from '@/lib/vector/editor';

type DropPlace = 'above' | 'below';

/**
 * Object list. Top of the list is the top of the stacking order.
 * Rows can be renamed in place, drag-reordered, multi-selected with Shift and
 * muted or locked without leaving the panel.
 */
export const LayersPanel = memo(function LayersPanel({
  layers,
  selectedIds,
  onSelect,
  onToggle,
  onDelete,
  onRename,
  onReorder,
}: {
  layers: LayerInfo[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, kind: 'visible' | 'locked') => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (id: string, targetId: string, place: DropPlace) => void;
}) {
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; place: DropPlace } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(() => [...layers].reverse(), [layers]);
  const term = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      term
        ? ordered.filter((layer) => layer.label.toLowerCase().includes(term) || layer.tag.includes(term))
        : ordered,
    [ordered, term],
  );
  const groups = ordered.filter((layer) => layer.tag === 'g').length;

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  function startRename(layer: LayerInfo) {
    setRenaming(layer.id);
    setDraft(layer.label);
  }

  function commitRename() {
    if (!renaming) return;
    const name = draft.trim();
    if (name) onRename(renaming, name);
    setRenaming(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--r-control)] border border-line px-1.5">
            <StudioIcon name="search" size={12} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find object"
              aria-label="Find object"
              className="h-6 min-w-0 flex-1 bg-transparent text-2xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-ink-faint hover:text-ink"
                aria-label="Clear search"
              >
                <StudioIcon name="close" size={10} />
              </button>
            )}
          </div>
        </div>
        {!query && (
          <div className="mt-1 flex items-center gap-1 text-2xs text-ink-faint">
            <StudioIcon name="layers" size={11} />
            <span className="tabular-nums">
              {layers.length} {layers.length === 1 ? 'object' : 'objects'}
              {groups > 0 ? `, ${groups} ${groups === 1 ? 'group' : 'groups'}` : ''}
              {selectedIds.length ? `, ${selectedIds.length} selected` : ''}
            </span>
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {!ordered.length && (
          <li className="flex flex-col items-center gap-1 px-3 py-6 text-center text-ink-faint">
            <StudioIcon name="layers" size={18} />
            <span className="text-2xs">No objects</span>
          </li>
        )}
        {visible.map((layer) => {
          const selected = selectedIds.includes(layer.id);
          const isDrop = dropTarget?.id === layer.id;
          return (
            <li
              key={layer.id}
              draggable={!term}
              onDragStart={(event) => {
                setDragging(layer.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', layer.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropTarget(null);
              }}
              onDragOver={(event) => {
                if (!dragging || dragging === layer.id) return;
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                const place: DropPlace = event.clientY < box.top + box.height / 2 ? 'above' : 'below';
                setDropTarget((current) =>
                  current?.id === layer.id && current.place === place ? current : { id: layer.id, place },
                );
              }}
              onDragLeave={() => setDropTarget((current) => (current?.id === layer.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging && dragging !== layer.id) {
                  onReorder(dragging, layer.id, dropTarget?.place ?? 'above');
                }
                setDragging(null);
                setDropTarget(null);
              }}
              className={clsx(
                'group relative flex items-center',
                isDrop && (dropTarget?.place === 'above' ? 'shadow-[inset_0_1px_0_var(--brand)]' : 'shadow-[inset_0_-1px_0_var(--brand)]'),
                dragging === layer.id && 'opacity-40',
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(layer.id, 'visible')}
                className={clsx('shrink-0 px-1.5 py-2 text-ink-faint hover:text-ink', layer.hidden && 'text-brand')}
                aria-label={layer.hidden ? 'Show object' : 'Hide object'}
                title={layer.hidden ? 'Show' : 'Hide'}
              >
                <StudioIcon name={layer.hidden ? 'eye_off' : 'eye'} size={13} />
              </button>

              {renaming === layer.id ? (
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitRename();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setRenaming(null);
                    }
                  }}
                  aria-label="Object name"
                  className="min-w-0 flex-1 rounded-[var(--r-xs)] border border-brand bg-surface px-1 py-0.5 text-[0.75rem] text-ink focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={(event) => onSelect(layer.id, event.shiftKey)}
                  onDoubleClick={() => startRename(layer)}
                  className={clsx(
                    'flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left text-[0.75rem] transition-colors',
                    selected ? 'text-brand-fg' : 'text-ink-muted hover:text-ink',
                  )}
                  style={{ paddingLeft: `${2 + Math.min(layer.depth, 4) * 9}px` }}
                  title={`${layer.label} (double click to rename)`}
                >
                  <StudioIcon
                    name={layer.tag === 'g' ? 'layers' : ICON_FOR_TAG[layer.tag] ?? 'rect'}
                    size={13}
                    className={clsx('shrink-0', selected ? 'text-brand' : '')}
                  />
                  <span className={clsx('truncate', layer.hidden && 'line-through decoration-ink-faint/60')}>
                    {layer.label}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggle(layer.id, 'locked')}
                className={clsx(
                  'shrink-0 px-1 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink',
                  layer.locked && 'text-brand opacity-100',
                )}
                aria-label={layer.locked ? 'Unlock object' : 'Lock object'}
                title={layer.locked ? 'Unlock' : 'Lock'}
              >
                <StudioIcon name={layer.locked ? 'lock' : 'unlock'} size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(layer.id)}
                className="shrink-0 px-1.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                aria-label="Delete object"
                title="Delete"
              >
                <StudioIcon name="trash" size={12} />
              </button>
            </li>
          );
        })}
        {term && !visible.length && (
          <li className="px-3 py-4 text-center text-2xs text-ink-faint">No match</li>
        )}
      </ul>
    </div>
  );
});
