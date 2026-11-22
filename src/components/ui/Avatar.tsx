import clsx from 'clsx';
import { avatarUrlFor } from '@/lib/avatar';

interface AvatarProps {
  /** Stored avatar string from user metadata (seed:palette:pattern or data URI). */
  stored?: string | null;
  /** Seed used to generate the default avatar (user id or email). */
  seed: string;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Profile picture. Shows the generated or uploaded avatar; never a bare
 * initial letter. Falls back to a generated avatar when nothing is stored.
 */
export function Avatar({ stored, seed, size = 32, className, alt = 'Profile picture' }: AvatarProps) {
  const src = avatarUrlFor(stored, seed);
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={clsx('shrink-0 rounded-full object-cover ring-1 ring-black/10', className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
