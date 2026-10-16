import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';

/**
 * Inhabitants added by each completed 2-second focus tick. The cadence is the
 * same fine-grained clock that grows the city (M2.T12), so the population
 * advances visibly while the session runs instead of jumping at a few minute
 * thresholds.
 */
export const POPULATION_PER_TICK = 5;

/**
 * Clamp untrusted focused time (§1.4), mirroring the growth engine's
 * `ticksFor`: `NaN` is "no time yet", a negative value clamps to 0 and
 * `+Infinity` stays infinite so the population grows without bound.
 */
function normalizeFocusedMs(focusedMs: number): number {
  if (Number.isNaN(focusedMs)) return 0;
  return Math.max(0, focusedMs);
}

/**
 * Population of the city built for `focusedMs` of undistracted focus (roadmap
 * M2.T18): every completed 2-second focus tick adds {@link POPULATION_PER_TICK}
 * inhabitants, so the counter evolves continuously with the elapsed focus time.
 *
 * The time is the *same* running-only quantity that grows the city (the
 * background's growth tracker, M2.T15), so the population always agrees with
 * the city that was actually built and excludes paused gaps. It is a function
 * of elapsed focus time, not of the rendered grid: it keeps growing even after
 * the grid is visually full (roadmap M2.T12), because the cap is on rendering,
 * never on session progress.
 *
 * Pure and total: same input → same output, no internal
 * `Date.now()`/`Math.random()` (principles D, §1.4). A partial tick contributes
 * nothing — only whole 2-second ticks count.
 */
export function calculatePopulation(focusedMs: number): number {
  const elapsed = normalizeFocusedMs(focusedMs);
  return Math.floor(elapsed / GROWTH_TICK_MS) * POPULATION_PER_TICK;
}
