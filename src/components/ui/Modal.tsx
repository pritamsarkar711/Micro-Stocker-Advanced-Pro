import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { GIcon } from './GoogleIcon';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dismissible?: boolean;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // A touch user did not come here with a keyboard, and focusing the close
    // button paints a focus ring that reads as a pressed state. Focus the panel
    // instead; keyboard and mouse users still land on the first control.
    const timer = setTimeout(() => {
      if (window.matchMedia('(pointer: coarse)').matches) {
        panelRef.current?.focus();
        return;
      }
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose, dismissible]);

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
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        className={clsx(
          'relative flex w-full flex-col overflow-hidden border border-line bg-surface shadow-[var(--shadow-pop)] outline-none',
          'rounded-t-[8px] sm:r-dialog',
          'max-h-[92dvh] sm:max-h-[85dvh]',
          SIZES[size],
        )}
        style={{ animation: 'toast-in 150ms ease-out both' }}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0">
              {title && <h2 className="text-base font-bold text-fg">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-[0.75rem] text-fg-muted">{description}</p>
              )}
            </div>
            {dismissible && <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
              <GIcon name="close" size={18} />
            </Button>}
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

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
