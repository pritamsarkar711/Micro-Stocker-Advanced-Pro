import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { GIcon } from './GoogleIcon';
import { Button } from './Button';

export function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text: string) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

export function Spinner({ className, size = 4 }: { className?: string; size?: number }) {
  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-14',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center r-control border border-line bg-surface-2 text-brand">
        {icon ?? <GIcon name="inbox" size={24} />}
      </div>
      <div className="max-w-md">
        <p className="display text-[0.9375rem] font-semibold text-fg">{title}</p>
        {description && <p className="mt-1 text-xs text-fg-muted sm:text-sm">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function CodeBlock({
  code,
  language = 'sql',
  maxHeight = '24rem',
  onCopy,
}: {
  code: string;
  language?: string;
  maxHeight?: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyText(code);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="overflow-hidden r-control border border-line bg-surface-2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="font-mono text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
          {language}
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={copy}
          icon={
            copied ? (
              <GIcon name="check" size={14} className="text-ok" />
            ) : (
              <GIcon name="content_copy" size={14} />
            )
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-auto p-3 font-mono text-xs text-fg-muted" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse r-control bg-surface-3', className)} />;
}
