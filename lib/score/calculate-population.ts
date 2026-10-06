import { BUILDING_UNLOCK_SCHEDULE } from '@/lib/city/building-composer';

/**
 * Inhabitants added by one house (a building's base/foundation). Together with
 * {@link POPULATION_PER_FLOOR} this is the formula stated by the project design
 * document for the city population ("+5 per house, +15 per building floor").
 */
export const POPULATION_PER_HOUSE = 5;

/** Inhabitants added by one building floor stacked on top of the base. */
export const POPULATION_PER_FLOOR = 15;

/**
 * Clamp untrusted focused time (§1.4), mirroring `composeBuilding` (M2.T11c):
 * `NaN` is "no time yet", a negative value clamps to 0 and `+Infinity` stays
 * infinite so every step of the schedule is considered unlocked.
 */
function normalizeFocusedMinutes(minutesFocused: number): number {
  if (Number.isNaN(minutesFocused)) return 0;
  return Math.max(0, minutesFocused);
}

/**
 * Population of a city built for `minutesFocused` of undistracted focus
 * (roadmap M2.T18): every unlocked `base` is a house (+5) and every unlocked
 * `floor` is a building floor (+15); `top` elements are decorative and add no
 * inhabitants. The unlock schedule is the same data the building composer
 * (`lib/city/building-composer.ts`, M2.T11c) uses, so the population matches
 * what the composer actually builds for the same focused time.
 *
 * The value therefore evolves with elapsed focus time, not with the rendered
 * grid: it keeps growing even after the grid is visually full (roadmap M2.T12),
 * and never depends on the randomly chosen module variants (only on which
 * categories are unlocked). Pure and total: same minutes → same population, no
 * internal `Date.now()`/`Math.random()` (principles D, §1.4).
 */
export function calculatePopulation(minutesFocused: number): number {
  const minutes = normalizeFocusedMinutes(minutesFocused);

  return BUILDING_UNLOCK_SCHEDULE.reduce((population, rule) => {
    if (rule.minuteThreshold > minutes) return population;
    if (rule.moduleCategory === 'base') return population + POPULATION_PER_HOUSE;
    if (rule.moduleCategory === 'floor') return population + POPULATION_PER_FLOOR;
    // `top` elements are decoration: no inhabitants.
    return population;
  }, 0);
}
