import clsx from 'clsx';
import { checkPassword, strengthTone } from '@/lib/auth/password';

/**
 * Four segment strength meter with one actionable hint. Stays quiet until the
 * user has typed something, so it never nags an empty form.
 */
export function PasswordMeter({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  const check = checkPassword(value);
  const filled = check.score === 0 ? 1 : check.score;
  const tone = strengthTone(check.score);
  const hint = check.ok ? check.hints[0] : check.error;

  return (
    <div className={clsx('space-y-1', className)} aria-live="polite">
      <div className="flex items-center gap-1" role="img" aria-label={`Password strength: ${check.label}`}>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors',
              index < filled ? tone : 'bg-line',
            )}
          />
        ))}
        <span className="ml-1 w-16 text-right text-2xs font-medium text-ink-muted">{check.label}</span>
      </div>
      {hint && (
        <p className={clsx('text-2xs leading-snug', check.ok ? 'text-ink-muted' : 'text-danger')}>{hint}</p>
      )}
    </div>
  );
}
