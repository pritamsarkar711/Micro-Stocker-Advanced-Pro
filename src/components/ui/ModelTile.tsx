import clsx from 'clsx';
import { GIcon, type GoogleIconName } from './GoogleIcon';
import { formatBytes } from '@/lib/modelStore';
import type { ModelProgressEvent } from '@/lib/desktop';

export interface ModelTileProps {
  name: string;
  icon: GoogleIconName;
  badge: string;
  license: string;
  sizeMB: number;
  selected: boolean;
  builtin?: boolean;
  installed?: boolean;
  desktopOnly?: boolean;
  isDesktop?: boolean;
  progress?: ModelProgressEvent;
  onSelect: () => void;
  onInstall?: () => void;
  onCancel?: () => void;
  onUninstall?: () => void;
}

/**
 * Compact Material 3 model row with leading icon, status pills and direct in
 * app download, live byte progress, cancel and uninstall controls.
 */
export function ModelTile({
  name,
  icon,
  badge,
  license,
  sizeMB,
  selected,
  builtin = false,
  installed = false,
  desktopOnly = false,
  isDesktop = false,
  progress,
  onSelect,
  onInstall,
  onCancel,
  onUninstall,
}: ModelTileProps) {
  const downloading = Boolean(progress && progress.phase !== 'ready');
  const pct =
    downloading && progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100))
      : 0;

  return (
    <div
      className={clsx(
        'group relative rounded-[var(--r-control)] border px-2.5 py-2 transition-colors',
        selected
          ? 'border-accent bg-accent-soft/75'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
      )}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span
            className={clsx(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-[5px]',
              selected ? 'bg-accent text-on-brand' : 'bg-surface-2 text-ink-muted',
            )}
          >
            <GIcon name={icon} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-ink">{name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted">
              <span className="font-medium text-ink">{badge}</span>
              <span>·</span>
              <span>{license}</span>
              {sizeMB > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">
                    {sizeMB >= 1000 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        {builtin ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-xs)] bg-accent-soft px-1.5 py-0.5 text-2xs font-medium text-accent">
            <GIcon name="check_circle" size={12} />
            Ready
          </span>
        ) : downloading ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--r-xs)] border border-line bg-surface px-2 text-2xs font-medium text-ink-muted hover:text-danger"
            title="Cancel download"
          >
            <GIcon name="close" size={13} />
            {pct > 0 ? `${pct}%` : 'Stop'}
          </button>
        ) : installed ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-[var(--r-xs)] bg-accent-soft px-1.5 py-0.5 text-2xs font-medium text-accent">
              <GIcon name="download_done" size={12} />
              Installed
            </span>
            {onUninstall && (
              <button
                type="button"
                onClick={onUninstall}
                className="inline-flex size-6 items-center justify-center rounded-[var(--r-xs)] text-ink-faint hover:bg-surface-2 hover:text-danger"
                aria-label={`Uninstall ${name}`}
                title="Uninstall model"
              >
                <GIcon name="delete" size={13} />
              </button>
            )}
          </div>
        ) : onInstall && (!desktopOnly || isDesktop) ? (
          <button
            type="button"
            onClick={onInstall}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--r-xs)] border border-line bg-surface px-2 text-2xs font-semibold text-accent hover:border-accent hover:bg-accent-soft"
          >
            <GIcon name="download" size={13} />
            Install
          </button>
        ) : (
          <button
            type="button"
            onClick={onInstall}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--r-xs)] border border-line bg-surface-2 px-2 text-2xs font-medium text-ink-muted hover:border-accent hover:text-accent"
          >
            <GIcon name="download" size={13} />
            Install
          </button>
        )}
      </div>

      {downloading && progress && (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-2xs text-ink-muted tabular-nums">
            <span>
              {progress.phase === 'extracting'
                ? 'Installing package'
                : `${formatBytes(progress.loadedBytes)}${
                    progress.totalBytes > 0 ? ` / ${formatBytes(progress.totalBytes)}` : ''
                  }`}
            </span>
            {progress.speedBps > 0 && <span>{formatBytes(progress.speedBps)}/s</span>}
          </div>
        </div>
      )}
    </div>
  );
}
