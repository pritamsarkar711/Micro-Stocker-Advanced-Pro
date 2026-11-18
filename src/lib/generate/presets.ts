import type { GeneratorKind } from './run';

/**
 * Prompt presets.
 *
 * A preset is the art direction, written once by the studio. The customer only
 * types the idea, and the two are combined here before anything is sent to the
 * model. New presets are data, so adding a pack never touches a component.
 */
export interface PromptPreset {
  id: string;
  label: string;
  /** One short line shown under the select. */
  hint?: string;
  /** Appended after the idea. */
  direction: string;
  kinds: GeneratorKind[];
}

export const PROMPT_PRESETS: PromptPreset[] = [];

export function presetsFor(kind: GeneratorKind): PromptPreset[] {
  return PROMPT_PRESETS.filter((preset) => preset.kinds.includes(kind));
}

/** Idea first, direction second, so the user's subject always leads. */
export function composePrompt(idea: string, preset: PromptPreset | null): string {
  const clean = idea.trim();
  if (!preset) return clean.slice(0, 600);
  return `${clean}. ${preset.direction}`.slice(0, 600);
}
