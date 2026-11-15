import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { Check, Copy, Inbox } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ className, size = 4 }: { className?: string; size?: number }) {
  return (
    <span
      className={clsx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
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
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-16',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-fg-subtle">
        {icon ?? <Inbox className="size-7" />}
      </div>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-fg sm:text-base">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-fg-muted sm:text-sm">{description}</p>
        )}
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
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const area = document.createElement('textarea');
      area.value = code;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="overflow-hidden rounded-[0.375rem] border border-line bg-surface-2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <span className="font-mono text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
          {language}
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={copy}
          icon={copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre
        className="overflow-auto p-3 font-mono text-xs text-fg-muted"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-fg-muted">
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-surface-3', className)} />;
}
