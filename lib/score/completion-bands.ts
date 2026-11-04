/**
 * Completion bands (CR3): the single table driving both the session score and
 * the population earned per character. `fromRatio` is the first completion
 * (built characters ÷ total) that belongs to the band; bands are contiguous,
 * half-open and ascending, so a band ends where the next one starts.
 *
 * `populationPerCharacter` is the marginal rate of a character built inside the
 * band. The `excellent` band is reached only at 100%, where no further
 * character exists, so its rate is 0 (the completion bonus is separate).
 */
export const COMPLETION_BANDS = [
  { fromRatio: 0, level: 'bad', populationPerCharacter: 5 },
  { fromRatio: 0.3, level: 'good', populationPerCharacter: 10 },
  { fromRatio: 0.7, level: 'great', populationPerCharacter: 20 },
  { fromRatio: 1, level: 'excellent', populationPerCharacter: 0 },
] as const;

export type CompletionLevel = (typeof COMPLETION_BANDS)[number]['level'];

/** Share of the population reached (before the bonus) added at 100% completion. */
export const COMPLETION_BONUS_SHARE = 0.07;

/**
 * First character count that belongs to the band starting at `fromRatio`.
 * `ceil` keeps "at least 30%" exact when `30% × total` is not an integer
 * (total 601 → 181 characters, i.e. 30.12%). Invalid totals give 0.
 */
export function bandCutoffCharacters(fromRatio: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(fromRatio * total);
}

/**
 * Completion ratio clamped to `[0, 1]`. Untrusted input is defensive:
 * non-finite or negative characters, and a non-finite or non-positive total,
 * all degrade to 0 instead of `NaN`.
 */
export function calculateCompletion(
  builtCharacters: number,
  total: number,
): number {
  if (!Number.isFinite(builtCharacters) || !Number.isFinite(total)) return 0;
  if (builtCharacters <= 0 || total <= 0) return 0;
  return Math.min(1, builtCharacters / total);
}
