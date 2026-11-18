import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
}

interface ToastApi {
  push: (kind: ToastKind, title: string, description?: string, duration?: number) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  warning: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<(ToastApi & { toasts: Toast[] }) | null>(null);

const ICONS: Record<ToastKind, GoogleIconName> = {
  success: 'check_circle',
  error: 'cancel',
  warning: 'info',
  info: 'info',
};

const TONES: Record<ToastKind, { box: string; icon: string }> = {
  success: { box: 'border-ok/40', icon: 'text-ok' },
  error: { box: 'border-danger/40', icon: 'text-danger' },
  warning: { box: 'border-brand/35', icon: 'text-brand' },
  info: { box: 'border-brand/40', icon: 'text-brand' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string, duration = 3800) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, description, duration }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi & { toasts: Toast[] }>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description, 5500),
      warning: (title, description) => push('warning', title, description, 4500),
      info: (title, description) => push('info', title, description),
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // Phones show toasts under the app bar: a bottom toast would sit on top of
        // the tab bar or the page action bar for the few seconds it lives.
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+env(safe-area-inset-top,0px))] z-[100] flex flex-col items-center gap-2 p-3 lg:inset-x-auto lg:top-auto lg:right-4 lg:bottom-4 lg:items-end lg:p-0"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.kind];
          return (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 r-dialog border border-line bg-surface p-3 shadow-[var(--shadow-pop)]',
                tone.box,
              )}
              style={{ animation: 'toast-in 150ms ease-out both' }}
            >
              <GIcon name={ICONS[toast.kind]} size={20} className={clsx('mt-0.5', tone.icon)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="r-control p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <GIcon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
