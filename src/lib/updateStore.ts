import {
  RELEASES_PAGE,
  apkInstallAllowed,
  checkForUpdates,
  desktopDownloadUpdate,
  desktopInstallUpdate,
  downloadApk,
  installDownloadedApk,
  onDesktopUpdateProgress,
  openApkInstallSettings,
  type AvailableUpdate,
} from './updates';

/**
 * One update state for the whole app, so the banner and the Settings card never
 * disagree and the release API is asked at most once a day.
 */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'permission'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateState {
  phase: UpdatePhase;
  current?: string;
  update?: AvailableUpdate;
  percent: number;
  message?: string;
  checkedAt?: number;
}

const LAST_CHECK_KEY = 'msap.update.checkedAt';
const SNOOZE_KEY = 'msap.update.snooze';
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

let state: UpdateState = { phase: 'idle', percent: 0 };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* a broken subscriber must not stop the rest */
    }
  }
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateState(): UpdateState {
  return state;
}

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: checking once per session is fine */
  }
}

function snoozedUntil(): number {
  return readNumber(SNOOZE_KEY);
}

/** Ask GitHub (or electron-updater) whether a newer build exists. */
export async function checkUpdates(force = false): Promise<void> {
  if (inFlight) return inFlight;

  if (!force) {
    const last = readNumber(LAST_CHECK_KEY);
    if (last && Date.now() - last < CHECK_INTERVAL_MS) return;
    if (snoozedUntil() > Date.now()) return;
    if (state.phase !== 'idle' && state.phase !== 'current') return;
  }

  emit({ phase: 'checking', message: undefined });
  inFlight = (async () => {
    const result = await checkForUpdates();
    write(LAST_CHECK_KEY, String(Date.now()));
    emit({ current: result.current });
    if (!result.ok) {
      // A background check that cannot reach GitHub must not shout at the user;
      // a check they asked for should say what went wrong.
      emit({
        phase: force ? 'error' : 'idle',
        message: result.error ?? 'Could not check for updates',
        checkedAt: Date.now(),
      });
      return;
    }
    if (!result.update) {
      emit({ phase: 'current', update: undefined, checkedAt: Date.now() });
      return;
    }
    emit({ phase: 'available', update: result.update, percent: 0, message: undefined, checkedAt: Date.now() });
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/** "Later": stay quiet for a day, but keep the manual check in Settings. */
export function snoozeUpdate() {
  if (state.update) write(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  emit({ phase: 'idle' });
}

export function clearUpdateMessage() {
  if (state.phase === 'error') emit({ phase: state.update ? 'available' : 'idle', message: undefined });
}

/** Download and hand off to the right installer for this container. */
export async function beginUpdate(): Promise<void> {
  const update = state.update;
  if (!update) return;
  const channel = update.channel;

  if (channel === 'link') {
    window.open(RELEASES_PAGE, '_blank', 'noopener,noreferrer');
    return;
  }

  if (channel === 'desktop') {
    emit({ phase: 'downloading', percent: 0, message: undefined });
    const off = onDesktopUpdateProgress((progress) => {
      if (progress.status === 'downloading') emit({ phase: 'downloading', percent: Math.max(0, progress.percent ?? 0) });
      if (progress.status === 'downloaded') emit({ phase: 'ready', percent: 100 });
      if (progress.status === 'error') emit({ phase: 'error', message: progress.error ?? 'The update download failed' });
    });
    const started = await desktopDownloadUpdate();
    if (!started.ok) {
      off();
      emit({ phase: 'error', message: started.error ?? 'The update download failed' });
      return;
    }
    // Keep the listener: electron-updater reports progress asynchronously and
    // fires "downloaded" when the installer is complete.
    return;
  }

  // Android: the OS needs the user to allow installs from this app once.
  const allowed = await apkInstallAllowed();
  if (!allowed) {
    emit({
      phase: 'permission',
      message: 'Android needs your permission once: allow Micro Stocker to install the update, then tap Install again.',
    });
    await openApkInstallSettings();
    return;
  }
  if (!update.assetUrl) {
    emit({ phase: 'error', message: 'This release has no APK attached. Open the release page instead.' });
    return;
  }

  emit({ phase: 'downloading', percent: 0, message: undefined });
  try {
    const file = await downloadApk(update.assetUrl, (loaded, total) => {
      const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
      emit({ phase: 'downloading', percent });
    });
    emit({ phase: 'ready', percent: 100 });
    await installDownloadedApk(file.path);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    const hint = /different|incompatible|signature/i.test(text)
      ? 'Your installed copy was signed with an older key. Uninstall it once, install this APK from the release page, and every future update will install in place.'
      : /cancel/i.test(text)
        ? 'Update canceled.'
        : text;
    emit({ phase: 'error', message: hint });
  }
}

/** Called when the app returns to the foreground after granting the permission. */
export async function resumeAfterPermission(): Promise<void> {
  if (state.phase !== 'permission') return;
  if (await apkInstallAllowed()) {
    emit({ phase: 'available', message: 'Permission granted. Tap Update now to finish installing.' });
  }
}

export async function restartToInstall(): Promise<void> {
  await desktopInstallUpdate();
}
