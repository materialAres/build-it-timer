import {
  bandCutoffCharacters,
  COMPLETION_BANDS,
  COMPLETION_BONUS_SHARE,
} from './completion-bands';

/** Whole characters in `[0, total]`; untrusted input degrades to 0 (§1.4). */
function normalizeCharacters(builtCharacters: number, total: number): number {
  if (!Number.isFinite(builtCharacters) || builtCharacters <= 0) return 0;
  return Math.min(total, Math.floor(builtCharacters));
}

/**
 * Population of a full session before the completion bonus: every character
 * earns the rate of the band it is built in. Band `i` covers the characters
 * between its cutoff and the next band's cutoff, so the last band (100%) has
 * no characters of its own.
 */
function populationForCharacters(built: number, total: number): number {
  let population = 0;
  for (let i = 0; i < COMPLETION_BANDS.length - 1; i++) {
    const band = COMPLETION_BANDS[i];
    const start = bandCutoffCharacters(band.fromRatio, total);
    const end = bandCutoffCharacters(COMPLETION_BANDS[i + 1].fromRatio, total);
    population +=
      band.populationPerCharacter * Math.max(0, Math.min(built, end) - start);
  }
  return population;
}

/**
 * Population for `builtCharacters` out of `total` (CR3, supersedes the flat
 * rate of M2.T18).
 *
 * The rate is marginal: each character earns the rate of the band it is built
 * in, chosen by the completion *before* it is built, so crossing a cutoff
 * never changes earlier characters and the result is monotonic. At 100% a
 * bonus of {@link COMPLETION_BONUS_SHARE} of the population reached is added.
 *
 * `builtCharacters` is the net count (focus minus distraction, never below 0),
 * so a distraction takes back the latest character at its band's rate.
 *
 * Pure and total: no hard-coded total, no `Date.now()`/`Math.random()`;
 * non-finite or negative characters and an invalid `total` give 0.
 */
export function calculatePopulation(
  builtCharacters: number,
  total: number,
): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const built = normalizeCharacters(builtCharacters, total);
  const population = populationForCharacters(built, total);
  if (built < total) return population;
  return population + Math.round(population * COMPLETION_BONUS_SHARE);
}
