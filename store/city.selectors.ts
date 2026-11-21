import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { seedFromSession } from '@/lib/city/plan/seed';
import {
  advanceFall,
  visibleFloors,
  type FallState,
  type VisibleFloors,
} from '@/lib/city/plan/visible-floors';
import { TOTAL_CHARACTERS_PER_SESSION } from '@/lib/timer/focus-presets';
import type { CitySlice } from './city.slice';
import type { ScoreSlice } from './score.slice';

const NO_FLOORS: VisibleFloors = { complete: 0, partialFraction: 0, damaged: false };

// A plan is a pure function of the session id, so one remembered entry serves
// every store and every render: the plan is generated once per session.
let planCache: { readonly sessionId: string; readonly plan: CityPlan } | null = null;

export function planForSession(sessionId: string | null): CityPlan | null {
  if (sessionId === null) return null;
  if (planCache?.sessionId !== sessionId) {
    planCache = { sessionId, plan: generateCityPlan(seedFromSession(sessionId)) };
  }
  return planCache.plan;
}

/** The city plan of the current session (null before the first one). */
export const selectCityPlan = (state: CitySlice): CityPlan | null =>
  planForSession(state.city.sessionId);

let visibleCache: {
  readonly plan: CityPlan;
  readonly fall: FallState;
  readonly value: VisibleFloors;
} | null = null;

/**
 * The floors standing now, derived from the plan and the score. It returns the
 * same object while the plan and the built characters are unchanged, so a
 * component selecting it re-renders only when the city changes.
 *
 * The cache also remembers the current fall (`advanceFall`, I015): the top
 * floor is damaged only while the city is losing characters, so the change
 * from one count to the next decides it. A new plan starts a new history.
 * `resetVisibleCache` forgets it; production code never needs to, tests do.
 */
export function selectVisibleFloors(state: CitySlice & ScoreSlice): VisibleFloors {
  const plan = planForSession(state.city.sessionId);
  if (plan === null) return NO_FLOORS;
  const built = state.score.builtCharacters;
  if (visibleCache?.plan === plan && visibleCache.fall.built === built) {
    return visibleCache.value;
  }
  const fall = advanceFall(visibleCache?.plan === plan ? visibleCache.fall : null, built);
  const value = visibleFloors(plan, built, TOTAL_CHARACTERS_PER_SESSION, fall.lost);
  visibleCache = { plan, fall, value };
  return value;
}

export function resetVisibleCache(): void {
  visibleCache = null;
}
