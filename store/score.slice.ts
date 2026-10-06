import type { StateCreator } from 'zustand';
import { calculateScore } from '@/lib/score/calculate-score';
import type { ScoreLevel } from './store.types';
import type { AppState } from '.';

export interface ScoreState {
  readonly level: ScoreLevel;
  readonly distractionRatio: number;
  /**
   * Inhabitants of the current session's city (M2.T18). Computed upstream from
   * the focused time through the pure `calculatePopulation` function.
   */
  readonly population: number;
}

export interface ScoreSlice {
  readonly score: ScoreState;
  /**
   * Record the distraction ratio observed so far and recompute the session
   * level from it. The ratio is computed upstream (M2.T10/M2.T16); the slice
   * only derives the level through the pure threshold function (M2.T9).
   */
  setDistractionRatio(distractionRatio: number): void;
  /**
   * Record the city population for the current session (M2.T18). The value is
   * computed upstream from focused time through `calculatePopulation`; the
   * slice only stores it.
   */
  setPopulation(population: number): void;
}

const initialScoreState: ScoreState = {
  level: 'excellent',
  distractionRatio: 0,
  population: 0,
};

/**
 * Guard the population at the store boundary (§1.4): a non-finite or negative
 * value degrades to 0 instead of leaking into the persisted state/render.
 */
function normalizePopulation(population: number): number {
  if (!Number.isFinite(population)) return 0;
  return Math.max(0, Math.floor(population));
}

/**
 * Score state for the current session (M2.T9). Stays a thin delegation layer:
 * no scoring logic of its own, so the thresholds remain testable in isolation
 * in `lib/score/calculate-score.ts` (principle S). `score` is part of the
 * persisted state (`store/index.ts`), so the level survives a service worker
 * restart during a still-active session.
 */
export const createScoreSlice: StateCreator<AppState, [], [], ScoreSlice> = (set, get) => ({
  score: { ...initialScoreState },
  setDistractionRatio(distractionRatio: number): void {
    set({
      score: {
        ...get().score,
        level: calculateScore(distractionRatio),
        distractionRatio,
      },
    });
  },
  setPopulation(population: number): void {
    set({ score: { ...get().score, population: normalizePopulation(population) } });
  },
});

export const selectScoreLevel = (state: ScoreSlice): ScoreLevel =>
  state.score.level;

export const selectDistractionRatio = (state: ScoreSlice): number =>
  state.score.distractionRatio;

export const selectPopulation = (state: ScoreSlice): number =>
  state.score.population;
