/**
 * Password policy shared by every place that sets or changes a password.
 *
 * Length is the only hard requirement (eight characters, matching the server
 * policy), but obviously guessable strings are refused and the interface can
 * show a strength meter so users see the benefit of a longer passphrase.
 */

const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'iloveyou',
  'admin123',
  'letmein1',
  'welcome1',
  'abc12345',
  'football',
  'baseball',
  'sunshine',
  'princess',
  'dragon12',
  'monkey12',
  'master12',
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  hints: string[];
}

export function checkPassword(password: string): PasswordCheck {
  const value = String(password ?? '');
  const hints: string[] = [];
  const lower = value.toLowerCase();

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 16) score = Math.max(score, 3);

  const uniqueRatio = new Set(lower).size / Math.max(1, lower.length);
  if (uniqueRatio < 0.4) {
    score = Math.min(score, 1);
    hints.push('Avoid repeated characters.');
  }
  if (/(.)\1{2,}/.test(value)) {
    score = Math.min(score, 1);
    hints.push('Avoid runs of the same character.');
  }
  if (/^(19|20)\d{2}$/.test(value)) {
    score = 0;
    hints.push('Do not use a year on its own.');
  }
  if (COMMON.has(lower)) {
    score = 0;
    hints.push('This is one of the most common passwords.');
  }
  if (hints.length === 0) {
    if (value.length < 12) hints.push('Twelve characters or more is safer.');
    if (!/[^A-Za-z0-9]/.test(value)) hints.push('Add a symbol or a space.');
  }

  const labels: PasswordCheck['label'][] = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'];
  const capped = Math.max(0, Math.min(4, score)) as PasswordCheck['score'];

  if (!value) return { ok: false, error: 'Enter a password.', score: 0, label: 'Too short', hints };
  if (value.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.', score: 0, label: 'Too short', hints: ['Use at least 8 characters.'] };
  }
  if (value.length > 128) {
    return { ok: false, error: 'Password must be 128 characters or fewer.', score: capped, label: labels[capped], hints };
  }
  if (COMMON.has(lower)) {
    return { ok: false, error: 'That password is too common. Choose something unique.', score: 0, label: 'Weak', hints };
  }
  return { ok: true, score: capped, label: labels[capped], hints };
}

/** Compact strength view used by the forms. */
export function strengthTone(score: PasswordCheck['score']): string {
  if (score <= 1) return 'bg-brand';
  if (score === 2) return 'bg-brand/70';
  if (score === 3) return 'bg-brand/85';
  return 'bg-ink';
}
