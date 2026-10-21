/**
 * The single source of truth for the user-selectable focus durations and the
 * cadence they impose on the city (feature: user-selectable timer duration).
 *
 * The reward is *duration-neutral*: every preset earns exactly
 * {@link TOTAL_CHARACTERS_PER_SESSION} growth ticks over a full session, so a
 * longer focus builds the same city more slowly instead of a bigger one. Adding
 * a choice is a one-line edit to {@link PRESET_MINUTES}: the cadence, the UI
 * options and the validation all derive from it.
 *
 * Pure and total (principle D / §1.4): no clock, no randomness, no browser.
 */

/**
 * Total characters a session is worth, whatever the preset. The cadence is
 * therefore `durationMinutes * 60_000 / TOTAL_CHARACTERS_PER_SESSION` ms per
 * character, and the total is constant across presets.
 */
export const TOTAL_CHARACTERS_PER_SESSION = 600;

/**
 * The selectable session lengths, in whole minutes. This is the only array to
 * touch when adding or removing a choice.
 */
export const PRESET_MINUTES = [5, 10, 20, 30, 45, 60, 90, 120] as const;

export interface FocusPreset {
  /** User-facing length in whole minutes. */
  readonly minutes: number;
  /** Length in seconds (the value persisted in `timer.durationSeconds`). */
  readonly durationSeconds: number;
  /** Growth AND malus cadence for this preset, in ms. */
  readonly tickMs: number;
}

/**
 * Cadence of a preset: one character per `TOTAL_CHARACTERS_PER_SESSION` over the
 * whole session, i.e. the slower the session the longer the tick. Rounded to a
 * whole millisecond; the tiny rounding error changes the total by at most one
 * character and never breaks duration-neutrality in any meaningful way.
 */
function tickMsFor(minutes: number): number {
  return Math.round((minutes * 60_000) / TOTAL_CHARACTERS_PER_SESSION);
}

/** Build the preset descriptor for a length in whole minutes. */
function createPreset(minutes: number): FocusPreset {
  return { minutes, durationSeconds: minutes * 60, tickMs: tickMsFor(minutes) };
}

export const FOCUS_PRESETS: ReadonlyArray<FocusPreset> =
  PRESET_MINUTES.map(createPreset);

/** Preset a fresh install starts on. */
export const DEFAULT_FOCUS_MINUTES = 30;
export const DEFAULT_FOCUS_PRESET: FocusPreset = createPreset(
  DEFAULT_FOCUS_MINUTES,
);

/** The preset whose length is `seconds`, or `undefined` when none matches. */
export function findPresetByDurationSeconds(
  seconds: number,
): FocusPreset | undefined {
  return FOCUS_PRESETS.find((preset) => preset.durationSeconds === seconds);
}

/**
 * Session cadence for a persisted `durationSeconds`. Total/defensive: an unknown
 * value (corrupt storage, a forged message that slipped through) degrades to the
 * default preset rather than producing `NaN` (§1.4).
 */
export function tickMsForDurationSeconds(seconds: number): number {
  return (findPresetByDurationSeconds(seconds) ?? DEFAULT_FOCUS_PRESET).tickMs;
}

/** Whether a value is one of the offered presets (untrusted-input guard). */
export function isPresetDurationSeconds(seconds: number): boolean {
  return findPresetByDurationSeconds(seconds) !== undefined;
}
