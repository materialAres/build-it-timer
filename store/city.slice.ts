import type { StateCreator } from 'zustand';
import type { AppState } from '.';

/**
 * The city of the current session. Since CR6 the persisted city is only
 * `sessionId` (persist version 4): the plan is derived from it
 * (`selectCityPlan`) and the floors from the score (`selectVisibleFloors`,
 * `city.selectors.ts`), so there is no grid, layer or theme to keep.
 */
export interface CityState {
  readonly sessionId: string | null;
}

export interface CitySlice {
  readonly city: CityState;
  /**
   * Start a brand-new city for a fresh focus session (roadmap M2.T11): the new
   * session id gives a new plan. Invoked by `startTimer()` (M2.T1) on the
   * `idle → running` transition, never on a resume, so each session builds its
   * own city.
   */
  resetCityForNewSession(sessionId: string): void;
}

export function createCitySlice(): StateCreator<AppState, [], [], CitySlice> {
  return (set) => ({
    city: { sessionId: null },

    resetCityForNewSession(sessionId: string): void {
      set({ city: { sessionId } });
    },
  });
}

export const selectCity = (state: CitySlice): CityState => state.city;

export const selectCitySessionId = (state: CitySlice): string | null =>
  state.city.sessionId;
