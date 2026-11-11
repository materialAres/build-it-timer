import type { CityPlan } from './city-plan.types';
import { calculateFocusCharacters } from '@/lib/score/calculate-built-characters';

/**
 * What part of a plan is standing: `complete` whole floors in build order and
 * a partly paid floor on top (`partialFraction` of it, 0 when none). The top
 * floor is `damaged` only when characters were lost; while the city simply
 * grows it is under construction, so it never flashes red.
 */
export interface VisibleFloors {
  readonly complete: number;
  readonly partialFraction: number;
  readonly damaged: boolean;
}

const NOTHING: VisibleFloors = { complete: 0, partialFraction: 0, damaged: false };

/**
 * `built / total × plan.totalFloors` floors are visible (`city-3d.md` §4).
 * Fewer characters show fewer floors, newest first; a single character is worth
 * 0.33–0.5 floor, so every loss changes the result. Pure and total: invalid
 * input shows nothing, more characters than `total` clamp to the whole city.
 */
export function visibleFloors(
  plan: Pick<CityPlan, 'totalFloors'>,
  builtCharacters: number,
  total: number,
  lostCharacters: number,
): VisibleFloors {
  if (!Number.isFinite(builtCharacters) || builtCharacters <= 0) return NOTHING;
  if (!Number.isFinite(total) || total <= 0) return NOTHING;
  const built = Math.min(builtCharacters, total);
  const exact = (built * plan.totalFloors) / total;
  const complete = Math.floor(exact);
  const partialFraction = exact - complete;
  const lost = Number.isFinite(lostCharacters) && lostCharacters > 0;
  return { complete, partialFraction, damaged: partialFraction > 0 && lost };
}

/**
 * Characters earned by focus and then taken back: `focus − built`, never
 * negative. It comes from the persisted timer accumulators, so the damage of a
 * top floor survives a restart and needs no state of its own.
 */
export function calculateLostCharacters(
  focusedMs: number,
  durationMs: number,
  builtCharacters: number,
  total: number,
): number {
  const focus = calculateFocusCharacters(focusedMs, durationMs, total);
  return Math.max(0, focus - Math.max(0, builtCharacters));
}
