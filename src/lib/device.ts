/**
 * Android device capability detection.
 *
 * The upscalers ask this before showing a model: a phone with 3 GB of RAM
 * cannot hold a large neural graph plus a 4K frame buffer, so the catalog
 * only lists what this device can actually run. Detection uses the signals
 * the WebView exposes (device memory, core count, chipset from the user
 * agent) and degrades gracefully when a signal is missing.
 */

export type DeviceTier = 'low' | 'mid' | 'high';

export interface DeviceInfo {
  tier: DeviceTier;
  /** Approximate RAM in GB, 0 when the WebView does not report it. */
  ramGB: number;
  /** Logical CPU cores. */
  cores: number;
  /** Chipset string from the user agent when present (e.g. "SM8550"). */
  chipset: string;
  /** Human friendly label, e.g. "Snapdragon 8 Gen 2". */
  chipsetLabel: string;
}

const CHIPSET_LABELS: Array<[RegExp, string]> = [
  [/SM8[0-9]{3}/i, 'Snapdragon 8 series'],
  [/SM7[0-9]{3}/i, 'Snapdragon 7 series'],
  [/SM6[0-9]{3}/i, 'Snapdragon 6 series'],
  [/MT6[0-9]{3}/i, 'Dimensity'],
  [/MT8[0-9]{3}/i, 'Dimensity'],
  [/MT9[0-9]{3}/i, 'Dimensity'],
  [/MT6[0-9]{2}/i, 'Helio'],
  [/MT8[0-9]{2}/i, 'Helio'],
  [/Exynos/i, 'Exynos'],
  [/Tensor/i, 'Tensor'],
  [/Unisoc/i, 'Unisoc'],
];

export function detectDevice(): DeviceInfo {
  let ramGB = 0;
  let cores = 0;
  let chipset = '';
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number' && Number.isFinite(nav.deviceMemory)) {
      ramGB = nav.deviceMemory;
    }
    if (typeof nav.hardwareConcurrency === 'number') {
      cores = nav.hardwareConcurrency;
    }
    const ua = navigator.userAgent ?? '';
    const match = ua.match(/\b(SM\d{4}|MT\d{4}|MT\d{3}|Exynos\d*|Tensor|Unisoc[^\s;]*)/i);
    if (match) chipset = match[1].toUpperCase();
  } catch {
    /* detection is best effort */
  }

  // Tier from RAM first, cores second. Unknown RAM assumes a modern phone.
  const effectiveRam = ramGB > 0 ? ramGB : cores >= 8 ? 6 : 4;
  const tier: DeviceTier = effectiveRam >= 6 || cores >= 8 ? 'high' : effectiveRam >= 3 ? 'mid' : 'low';

  let chipsetLabel = chipset;
  for (const [re, label] of CHIPSET_LABELS) {
    if (re.test(chipset)) {
      chipsetLabel = label;
      break;
    }
  }

  return { tier, ramGB, cores, chipset, chipsetLabel };
}

/**
 * Whether a model of the given size fits this device tier.
 * Built-in engines always fit; neural graphs need headroom for the frame
 * buffer on top of the weights. `ceilings` overrides the default per-tier
 * size caps for tools whose models are inherently large (background removal).
 */
export function modelFitsDevice(
  sizeMB: number,
  tier: DeviceTier,
  ceilings: { low: number; mid: number } = { low: 16, mid: 64 },
): boolean {
  if (sizeMB <= 0) return true;
  if (tier === 'high') return true;
  if (tier === 'mid') return sizeMB <= ceilings.mid;
  return sizeMB <= ceilings.low;
}
