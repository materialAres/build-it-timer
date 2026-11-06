import type { ScoreLevel } from '@/store/store.types';
import { bandCutoffCharacters, COMPLETION_BANDS } from './completion-bands';

/**
 * Session score level for `builtCharacters` out of `total` (CR3, supersedes
 * the ratio thresholds of M2.T9).
 *
 * The level is the one of the highest band in {@link COMPLETION_BANDS} whose
 * cutoff (`ceil(fromRatio × total)`) the built characters reach: `bad` below
 * 30%, `good` from 30%, `great` from 70%, `excellent` only at 100%. Nothing
 * depends on the value of `total`, so the same rule holds if it grows.
 *
 * It is recalculated from the live count, so the level can drop back when a
 * distraction removes characters.
 *
 * Total and defensive: `NaN`, `±Infinity`, negative values and an invalid
 * `total` give `'bad'`; a finite count above `total` is clamped to
 * `'excellent'`. Never throws.
 */
export function calculateScore(
  builtCharacters: number,
  total: number,
): ScoreLevel {
  if (
    !Number.isFinite(builtCharacters) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return 'bad';
  }
  const built = Math.min(total, Math.floor(builtCharacters));
  let level: ScoreLevel = COMPLETION_BANDS[0].level;
  for (const band of COMPLETION_BANDS) {
    if (built >= bandCutoffCharacters(band.fromRatio, total)) {
      level = band.level;
    }
  }
  return level;
}
