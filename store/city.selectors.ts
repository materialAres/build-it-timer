import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { seedFromSession } from '@/lib/city/plan/seed';
import {
  calculateLostCharacters,
  visibleFloors,
  type VisibleFloors,
} from '@/lib/city/plan/visible-floors';
import { TOTAL_CHARACTERS_PER_SESSION } from '@/lib/timer/focus-presets';
import type { CitySlice } from './city.slice';
import type { ScoreSlice } from './score.slice';
import type { TimerSlice } from './timer.slice';

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
  readonly built: number;
  readonly lost: number;
  readonly value: VisibleFloors;
} | null = null;

/**
 * The floors standing now, derived from the plan and the score. It returns the
 * same object while the plan, the built characters and the lost characters are
 * unchanged, so a component selecting it re-renders only when the city changes.
 */
export function selectVisibleFloors(
  state: CitySlice & ScoreSlice & TimerSlice,
): VisibleFloors {
  const plan = planForSession(state.city.sessionId);
  if (plan === null) return NO_FLOORS;
  const built = state.score.builtCharacters;
  const lost = calculateLostCharacters(
    state.timer.focusedMs,
    state.timer.durationSeconds * 1000,
    built,
    TOTAL_CHARACTERS_PER_SESSION,
  );
  if (visibleCache?.plan === plan && visibleCache.built === built && visibleCache.lost === lost) {
    return visibleCache.value;
  }
  const value = visibleFloors(plan, built, TOTAL_CHARACTERS_PER_SESSION, lost);
  visibleCache = { plan, built, lost, value };
  return value;
}
