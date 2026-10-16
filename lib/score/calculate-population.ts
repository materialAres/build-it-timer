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
 * Population of the city built for `focusedMs` of undistracted focus and
 * `distractedMs` spent on blocked sites (roadmap M2.T18, extended): every
 * completed 2-second focus tick adds {@link POPULATION_PER_TICK} inhabitants and
 * every completed 2-second distraction tick removes the same amount, so the
 * counter both grows with progress and shrinks with distraction on the very same
 * cadence.
 *
 * The two times are the *same* running-only quantities the background measures
 * (M2.T15/M2.T16), so the population always agrees with the city that was
 * actually built and excludes paused gaps. Distracted time is deliberately not
 * also counted as focus time by the caller, so a tick on a blocked site yields a
 * net {@link POPULATION_PER_TICK} decrease.
 *
 * The result is clamped at zero: population is a count of inhabitants and can
 * never be negative, however long the distraction lasts.
 *
 * Pure and total: same input → same output, no internal
 * `Date.now()`/`Math.random()` (principles D, §1.4). A partial tick contributes
 * nothing — only whole 2-second ticks count.
 */
export function calculatePopulation(
  focusedMs: number,
  distractedMs = 0,
): number {
  const focusTicks = Math.floor(normalizeFocusedMs(focusedMs) / GROWTH_TICK_MS);
  const distractionTicks = Math.floor(
    normalizeFocusedMs(distractedMs) / GROWTH_TICK_MS,
  );
  return Math.max(0, focusTicks - distractionTicks) * POPULATION_PER_TICK;
}
