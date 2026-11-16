/**
 * Size-cap options for the Prepare → re-encode recipe.
 *
 * Several portals share the same file-size budget (six use 50 MB), and the
 * `Select` control keys its options by `value`, so the values must be unique.
 * Portals are grouped by cap and the label names the first few.
 */
import { PLATFORM_LIST } from './platforms';

export interface SizeCapOption {
  value: string;
  label: string;
}

export function sizeCapOptions(limitMB = 60): SizeCapOption[] {
  const groups = new Map<number, string[]>();
  for (const platform of PLATFORM_LIST) {
    if (platform.maxFileMB > limitMB) continue;
    const names = groups.get(platform.maxFileMB) ?? [];
    names.push(platform.name);
    groups.set(platform.maxFileMB, names);
  }
  return [...groups.entries()].map(([mb, names]) => ({
    value: String(mb),
    label: `${mb} MB cap (${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''})`,
  }));
}
