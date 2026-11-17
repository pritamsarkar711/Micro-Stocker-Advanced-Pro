import { memo } from 'react';
import clsx from 'clsx';
import { StudioIcon } from '@/components/vector/StudioIcon';
import { ICON_FOR_TAG } from '@/lib/vector/tools';
import type { LayerInfo } from '@/lib/vector/editor';

/** Object list with visibility, lock, rename-free ordering and delete. */
export const LayersPanel = memo(function LayersPanel({
  layers,
  selectedIds,
  onSelect,
  onToggle,
  onDelete,
}: {
  layers: LayerInfo[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, kind: 'visible' | 'locked') => void;
  onDelete: (id: string) => void;
}) {
  const ordered = [...layers].reverse();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-2xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Objects</span>
        <span className="text-2xs tabular-nums text-ink-faint">{layers.length}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {!ordered.length && (
          <li className="px-3 py-3 text-[0.75rem] leading-relaxed text-ink-faint">
            Nothing here yet. Pick a shape on the left, then drag on the canvas.
          </li>
        )}
        {ordered.map((layer) => {
          const selected = selectedIds.includes(layer.id);
          return (
            <li key={layer.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => onToggle(layer.id, 'visible')}
                className={clsx('px-1.5 py-1.5 text-ink-faint hover:text-ink', layer.hidden && 'text-brand')}
                aria-label={layer.hidden ? 'Show object' : 'Hide object'}
                title={layer.hidden ? 'Show' : 'Hide'}
              >
                <StudioIcon name={layer.hidden ? 'eye_off' : 'eye'} size={13} />
              </button>
              <button
                type="button"
                onClick={(event) => onSelect(layer.id, event.shiftKey)}
                className={clsx(
                  'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[0.75rem] transition-colors',
                  selected ? 'text-brand-fg' : 'text-ink-muted hover:text-ink',
                )}
                style={{ paddingLeft: `${2 + layer.depth * 9}px` }}
              >
                <StudioIcon name={ICON_FOR_TAG[layer.tag] ?? 'rect'} size={13} className={selected ? 'text-brand' : ''} />
                <span className="truncate">{layer.label}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggle(layer.id, 'locked')}
                className={clsx('px-1 text-ink-faint hover:text-ink', layer.locked && 'text-brand')}
                aria-label={layer.locked ? 'Unlock object' : 'Lock object'}
                title={layer.locked ? 'Unlock' : 'Lock'}
              >
                <StudioIcon name={layer.locked ? 'lock' : 'unlock'} size={12} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(layer.id)}
                className="px-1.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                aria-label="Delete object"
                title="Delete"
              >
                <StudioIcon name="trash" size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
