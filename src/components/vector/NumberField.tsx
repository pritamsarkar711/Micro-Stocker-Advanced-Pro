import { useEffect, useState } from 'react';

/** Numeric input that commits on blur or Enter so history stays one step. */
export function NumberField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);
  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setText(String(Math.round(value)));
  };
  return (
    <label className="flex h-7 min-w-0 items-center gap-1 rounded-[var(--r-control)] border border-line bg-surface px-1.5 focus-within:border-brand">
      <span className="shrink-0 text-2xs text-ink-faint">{label}</span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        disabled={disabled}
        inputMode="numeric"
        className="w-full min-w-0 bg-transparent text-[0.75rem] tabular-nums text-ink outline-none disabled:opacity-50"
        aria-label={label}
      />
    </label>
  );
}
