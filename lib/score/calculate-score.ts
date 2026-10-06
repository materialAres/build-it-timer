import type { ScoreLevel } from '@/store/store.types';

/**
 * Inclusive upper boundary of the `'good'` band, as a distraction ratio.
 * `0` is `'excellent'`, `(0, 0.3]` is `'good'`, anything above is `'bad'`.
 */
export const GOOD_MAX_RATIO = 0.3;

/**
 * Map a distraction ratio to the session score level (M2.T9).
 *
 * The ratio is the distraction time divided by the focus time **actually
 * elapsed so far** (not the planned session duration), so it is recalculated at
 * every check and the level can change during a session. How the ratio is
 * derived from individual distraction events is an open point of the plan
 * (roadmap §4): this function only owns the stable `ratio -> level` threshold,
 * independent of how the ratio is computed upstream.
 *
 * Thresholds (updated): exactly `0` is `'excellent'`, `<= 0.3` is `'good'`,
 * `> 0.3` is `'bad'` — two thresholds, three levels, no gray zones.
 *
 * Total and defensive (the ratio crosses an untrusted boundary): a non-finite
 * value is clamped into `[0, 1]` rather than allowed to leak into a comparison
 * (`NaN` is treated as `0`, the "no distraction observed" default, mirroring
 * `formatDuration`, M2.T3). Never throws.
 */
export function calculateScore(distractionRatio: number): ScoreLevel {
  const ratio = Number.isNaN(distractionRatio)
    ? 0
    : Math.min(1, Math.max(0, distractionRatio));

  if (ratio === 0) return 'excellent';
  if (ratio <= GOOD_MAX_RATIO) return 'good';
  return 'bad';
}
