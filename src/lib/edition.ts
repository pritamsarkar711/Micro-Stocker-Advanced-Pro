/**
 * Edition seam.
 *
 * The app is one binary with one feature set: everything ships in the free
 * edition and works with free models or the user's own free-tier keys. This
 * module exists so that a paid edition can be added later **without touching
 * feature code again**: callers ask `can('feature')`, never "am I Pro?".
 *
 * Deliberately *not* implemented yet:
 *   - no licence check, no server call, no key validation;
 *   - no upsell UI, no locked buttons, no trial countdown;
 *   - `pro` is a declared shape, not a product.
 *
 * When Pro is defined, only `resolveEdition()` and `PRO_FEATURES` need to
 * change. Nothing here reads the network, so the free edition can never be
 * degraded by a failed licence call.
 */

export type Edition = 'free' | 'pro';

/** Every capability that could ever be gated. Free gets all of them today. */
export type Feature =
  | 'metadata.ai'
  | 'metadata.ai.local'
  | 'metadata.ai.byok'
  | 'upscale.ai'
  | 'export.csv'
  | 'export.embed'
  | 'cloud.sync'
  | 'batch.unlimited';

/**
 * Features reserved for the paid edition. Empty on purpose: shipping a Pro
 * edition means moving ids here and implementing the licence check first.
 */
export const PRO_FEATURES: readonly Feature[] = [] as const;

/** Everything the current build grants. */
export const FREE_FEATURES: readonly Feature[] = [
  'metadata.ai',
  'metadata.ai.local',
  'metadata.ai.byok',
  'upscale.ai',
  'export.csv',
  'export.embed',
  'cloud.sync',
  'batch.unlimited',
] as const;

/**
 * The active edition. Hard-coded on purpose — there is no purchase flow yet,
 * and silently reading a stored flag would be a paid feature by the back door.
 */
export function resolveEdition(): Edition {
  return 'free';
}

export interface Entitlements {
  edition: Edition;
  features: ReadonlySet<Feature>;
  can: (feature: Feature) => boolean;
}

export function entitlements(edition: Edition = resolveEdition()): Entitlements {
  const features = new Set<Feature>(edition === 'pro' ? [...FREE_FEATURES, ...PRO_FEATURES] : FREE_FEATURES);
  return { edition, features, can: (feature) => features.has(feature) };
}

/** Convenience for components that only need one answer. */
export const can = (feature: Feature): boolean => entitlements().can(feature);
