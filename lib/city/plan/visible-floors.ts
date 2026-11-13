import type { CityPlan } from './city-plan.types';

/**
 * What part of a plan is standing: `complete` whole floors in build order and
 * a partly paid floor on top (`partialFraction` of it, 0 when none). The top
 * floor is `damaged` only while the city is losing characters (`advanceFall`);
 * while it grows, also after a loss, it is under construction, so it never
 * flashes red (I015).
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
 * `lostCharacters` is the current fall (`advanceFall`), not the session's losses.
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

/** The count last seen and the characters lost since the city last grew. */
export interface FallState {
  readonly built: number;
  readonly lost: number;
}

/**
 * Follow the built count from one observation to the next (I015). A drop adds
 * to the current fall; any growth ends it, because the new characters are
 * construction, not damage. The first observation starts with nothing lost:
 * a view opened mid-session cannot tell a fall from a regrowth, and showing a
 * regrowing city as damaged is the worse mistake. Invalid counts count as 0.
 */
export function advanceFall(previous: FallState | null, builtCharacters: number): FallState {
  const built = Number.isFinite(builtCharacters) ? Math.max(0, builtCharacters) : 0;
  if (previous === null) return { built, lost: 0 };
  if (built < previous.built) return { built, lost: previous.lost + previous.built - built };
  if (built > previous.built) return { built, lost: 0 };
  return previous;
}
