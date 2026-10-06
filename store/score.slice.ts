import type { StateCreator } from 'zustand';
import { calculateScore } from '@/lib/score/calculate-score';
import type { ScoreLevel } from './store.types';
import type { AppState } from '.';

export interface ScoreState {
  readonly level: ScoreLevel;
  readonly distractionRatio: number;
}

export interface ScoreSlice {
  readonly score: ScoreState;
  /**
   * Record the distraction ratio observed so far and recompute the session
   * level from it. The ratio is computed upstream (M2.T10/M2.T16); the slice
   * only derives the level through the pure threshold function (M2.T9).
   */
  setDistractionRatio(distractionRatio: number): void;
}

const initialScoreState: ScoreState = {
  level: 'excellent',
  distractionRatio: 0,
};

/**
 * Score state for the current session (M2.T9). Stays a thin delegation layer:
 * no scoring logic of its own, so the thresholds remain testable in isolation
 * in `lib/score/calculate-score.ts` (principle S). `score` is part of the
 * persisted state (`store/index.ts`), so the level survives a service worker
 * restart during a still-active session.
 */
export const createScoreSlice: StateCreator<AppState, [], [], ScoreSlice> = (set) => ({
  score: { ...initialScoreState },
  setDistractionRatio(distractionRatio: number): void {
    set({ score: { level: calculateScore(distractionRatio), distractionRatio } });
  },
});

export const selectScoreLevel = (state: ScoreSlice): ScoreLevel =>
  state.score.level;

export const selectDistractionRatio = (state: ScoreSlice): number =>
  state.score.distractionRatio;
