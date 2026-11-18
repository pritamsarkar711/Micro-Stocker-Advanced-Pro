/**
 * First-run state for the launch experience.
 *
 * Three keys are kept apart on purpose: the splash belongs to every cold start,
 * while the welcome tour is a one-time event and the authentication hand-off is
 * tracked separately so a returning user who signed out lands on the form during
 * the next launch instead of being dropped into the dashboard.
 */

const DONE_KEY = 'msap.launch.done';
const TOUR_KEY = 'msap.launch.tour';
const SPLASH_MS = 1_500;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private browsing can refuse storage; the flow still works per session. */
  }
}

export const launch = {
  /** How long the splash stays up before the next stage is allowed. */
  splashMs: SPLASH_MS,

  /** True once the user has walked through welcome, tour and auth at least once. */
  isComplete(): boolean {
    return read(DONE_KEY) === '1';
  },

  /** The tour is skipped for people who finished it on an earlier version. */
  hasSeenTour(): boolean {
    return read(TOUR_KEY) === '1' || launch.isComplete();
  },

  markTourSeen(): void {
    write(TOUR_KEY, '1');
  },

  complete(): void {
    write(DONE_KEY, '1');
    write(TOUR_KEY, '1');
  },

  /** Settings → "Show the welcome tour again" uses this. */
  reset(): void {
    try {
      localStorage.removeItem(DONE_KEY);
      localStorage.removeItem(TOUR_KEY);
    } catch {
      /* ignore */
    }
  },
};
