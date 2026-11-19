import { useEffect, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GIcon } from '@/components/ui/GoogleIcon';
import { formatBytes } from '@/lib/modelStore';
import {
  beginUpdate,
  checkUpdates,
  restartToInstall,
  resumeAfterPermission,
  snoozeUpdate,
  subscribeUpdate,
  updateState,
} from '@/lib/updateStore';

/**
 * In-app update notice.
 *
 * Rendered in normal document flow right under the page top, never as a fixed
 * overlay, so it cannot cover the mobile action bar or a toast. It only appears
 * when a newer release actually exists.
 */
export function UpdateNotice({ compact = false }: { compact?: boolean }) {
  const state = useSyncExternalStore(subscribeUpdate, updateState, updateState);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    void checkUpdates();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resumeAfterPermission();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const visible =
    state.phase === 'available' ||
    state.phase === 'downloading' ||
    state.phase === 'ready' ||
    state.phase === 'permission' ||
    state.phase === 'error';
  if (!visible || !state.update) return null;

  const update = state.update;
  const busy = state.phase === 'downloading';
  const sizeLabel = update.sizeBytes > 0 ? ` · ${formatBytes(update.sizeBytes)}` : '';
  const channelLine =
    update.channel === 'android'
      ? `Downloads inside the app${sizeLabel}. Android shows its own install prompt at the end.`
      : update.channel === 'desktop'
        ? 'The installer downloads in the background, then the app restarts into the new version.'
        : `Download the ${/\.dmg$/i.test(update.assetName ?? '') ? 'macOS' : 'new'} build from the release page${sizeLabel}.`;

  return (
    <div className="mb-3 overflow-hidden rounded-[var(--r-card)] border border-brand/40 bg-brand-soft/60">
      <div className="grid grid-cols-1 gap-3 p-3 sm:flex sm:items-start sm:gap-3 sm:p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-control)] bg-brand text-white">
          <GIcon name="install_desktop" size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">
              Version {update.version} is {state.phase === 'ready' ? 'downloaded' : 'available'}
            </p>
            {state.current && <Badge tone="outline">You have {state.current}</Badge>}
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
            {state.phase === 'permission' ? state.message ?? channelLine : channelLine}
          </p>

          {state.phase === 'downloading' && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200"
                  style={{ width: `${Math.max(3, state.percent)}%` }}
                />
              </div>
              <p className="mt-1 text-2xs tabular-nums text-ink-muted">{state.percent}% downloaded</p>
            </div>
          )}

          {state.phase === 'ready' && update.channel === 'desktop' && (
            <p className="mt-1 text-2xs text-ink-muted">
              Restart the app to finish. Your library and settings are kept.
            </p>
          )}

          {state.phase === 'error' && state.message && (
            <p className="mt-2 rounded-[var(--r-xs)] border border-danger/30 bg-danger-soft px-2 py-1.5 text-2xs leading-relaxed text-danger">
              {state.message}
              <button
                type="button"
                className="ml-1 font-semibold underline"
                onClick={() => window.open('https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases/latest', '_blank', 'noopener,noreferrer')}
              >
                Open the release page
              </button>
            </p>
          )}

          {!compact && update.notes && (
            <>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-2xs font-medium text-brand"
                onClick={() => setShowNotes((value) => !value)}
              >
                <GIcon name={showNotes ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={13} />
                What changed
              </button>
              {showNotes && (
                <div className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-line rounded-[var(--r-xs)] border border-line bg-surface/80 px-2.5 py-2 text-2xs leading-relaxed text-ink-muted">
                  {update.notes}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
          {state.phase === 'ready' && update.channel === 'desktop' ? (
            <Button size="sm" onClick={() => void restartToInstall()} icon={<GIcon name="restart_alt" size={15} />}>
              Restart
            </Button>
          ) : (
            <Button
              size="sm"
              loading={busy}
              disabled={state.phase === 'permission'}
              onClick={() => void beginUpdate()}
              icon={<GIcon name={update.channel === 'link' ? 'open_in_new' : 'download'} size={15} />}
            >
              {state.phase === 'downloading'
                ? `${state.percent}%`
                : update.channel === 'link'
                  ? 'Open release'
                  : state.phase === 'permission'
                    ? 'Allow installs'
                    : state.phase === 'ready'
                      ? 'Install'
                      : 'Update now'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => snoozeUpdate()}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
