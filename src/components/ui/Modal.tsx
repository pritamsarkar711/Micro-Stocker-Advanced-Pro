import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Responsive dialog: a centred modal on ≥sm screens, a bottom sheet on phones.
 * Closes on Escape and on backdrop click; locks body scroll while open.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={clsx(
          'relative flex w-full flex-col overflow-hidden border border-line bg-surface shadow-[var(--shadow-pop)]',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[92dvh] sm:max-h-[85dvh]',
          SIZES[size],
        )}
        style={{ animation: 'toast-in 180ms ease-out both' }}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
              {description && (
                <p className="mt-1 text-xs leading-relaxed text-fg-muted sm:text-sm">{description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
              <X className="size-4" />
            </Button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2 px-4 py-3 safe-bottom sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
