import { useEffect, useState } from 'react';
import { GIcon } from '@/components/ui/GoogleIcon';
import { desktop } from '@/lib/desktop';

/**
 * Frameless-window controls for the desktop build. The native title bar is
 * hidden so the product name never appears twice, and the window chrome shares
 * the exact typography, colour and corner radius of the application.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktop.isDesktop) return;
    void desktop.window.isMaximized().then(setMaximized);
    return desktop.window.onMaximizeChanged(setMaximized);
  }, []);

  if (!desktop.isDesktop) return null;

  // Hover colours live on each button so Tailwind never has to choose between
  // two conflicting `hover:text-*` utilities (the old close button lost that
  // fight and left a grey glyph on red).
  const base =
    'no-drag inline-flex h-8 w-9 items-center justify-center rounded-[var(--r-control)] transition-colors duration-150 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-surface';
  const quiet = `${base} text-ink-muted hover:bg-surface-2 hover:text-ink`;
  const danger = `${base} text-ink-muted hover:bg-danger hover:text-white active:bg-danger`;

  return (
    <div className="no-drag ml-1 flex shrink-0 items-center gap-0.5 pl-1">
      <button type="button" aria-label="Minimize window" title="Minimize" className={quiet} onClick={() => void desktop.window.minimize()}>
        <GIcon name="remove" size={15} />
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore window' : 'Maximize window'}
        title={maximized ? 'Restore' : 'Maximize'}
        className={quiet}
        onClick={() => void desktop.window.toggleMaximize().then(setMaximized)}
      >
        <GIcon name={maximized ? 'filter_none' : 'check_box_outline_blank'} size={14} />
      </button>
      <button
        type="button"
        aria-label="Close window"
        title="Close"
        className={danger}
        onClick={() => void desktop.window.close()}
      >
        <GIcon name="close" size={16} />
      </button>
    </div>
  );
}
