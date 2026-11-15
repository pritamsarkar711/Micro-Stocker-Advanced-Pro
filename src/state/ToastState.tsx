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
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

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

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONES: Record<ToastKind, { box: string; icon: string }> = {
  success: { box: 'border-ok/40', icon: 'text-ok' },
  error: { box: 'border-danger/40', icon: 'text-danger' },
  warning: { box: 'border-warn/40', icon: 'text-warn' },
  info: { box: 'border-brand/40', icon: 'text-brand-fg' },
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
    (kind: ToastKind, title: string, description?: string, duration = 4200) => {
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
      error: (title, description) => push('error', title, description, 6000),
      warning: (title, description) => push('warning', title, description, 5200),
      info: (title, description) => push('info', title, description),
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-3 safe-bottom sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end sm:p-0"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          const tone = TONES[toast.kind];
          return (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border bg-surface p-2.5 shadow-[var(--shadow-pop)]',
                tone.box,
              )}
              style={{ animation: 'toast-in 180ms ease-out both' }}
            >
              <Icon className={clsx('mt-0.5 size-5 shrink-0', tone.icon)} />
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
                className="rounded-md p-1 text-fg-subtle transition hover:bg-surface-3 hover:text-fg"
              >
                <X className="size-4" />
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
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
