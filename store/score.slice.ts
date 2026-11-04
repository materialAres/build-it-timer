import type { StateCreator } from 'zustand';
import { calculatePopulation } from '@/lib/score/calculate-population';
import { calculateScore } from '@/lib/score/calculate-score';
import { TOTAL_CHARACTERS_PER_SESSION } from '@/lib/timer/focus-presets';
import type { ScoreLevel } from './store.types';
import type { AppState } from '.';

export interface ScoreState {
  /**
   * Net characters built in the current session (CR3): the single stored
   * source of truth. `population` and `level` are derived from it.
   */
  readonly builtCharacters: number;
  readonly level: ScoreLevel;
  /** Inhabitants of the current session's city, derived from `builtCharacters`. */
  readonly population: number;
}

export interface ScoreSlice {
  readonly score: ScoreState;
  /**
   * Record the net characters built so far and derive the population and the
   * level from them (CR3). The count is computed upstream by
   * `calculateBuiltCharacters`; the slice only delegates to the pure
   * `calculatePopulation` and `calculateScore`.
   */
  setBuiltCharacters(builtCharacters: number): void;
}

/**
 * Guard the character count at the store boundary (§1.4): a non-finite or
 * negative value degrades to 0 instead of leaking into the persisted state.
 */
function normalizeBuiltCharacters(builtCharacters: number): number {
  if (!Number.isFinite(builtCharacters)) return 0;
  return Math.max(0, Math.floor(builtCharacters));
}

/**
 * Full score state for a character count. Also used to rebuild the persisted
 * score on rehydration, so a snapshot written before CR3 (with a stale level
 * or a flat-rate population) is repaired from its `builtCharacters` alone.
 */
export function deriveScoreState(builtCharacters: unknown): ScoreState {
  const built = normalizeBuiltCharacters(
    typeof builtCharacters === 'number' ? builtCharacters : 0,
  );
  return {
    builtCharacters: built,
    population: calculatePopulation(built, TOTAL_CHARACTERS_PER_SESSION),
    level: calculateScore(built, TOTAL_CHARACTERS_PER_SESSION),
  };
}

/**
 * Score state for the current session (M2.T9, CR3). Stays a thin delegation
 * layer: the band rules live in `lib/score/` (principle S). `score` is part of
 * the persisted state (`store/index.ts`), so it survives a service worker
 * restart during a still-active session.
 */
export const createScoreSlice: StateCreator<AppState, [], [], ScoreSlice> = (set) => ({
  score: deriveScoreState(0),
  setBuiltCharacters(builtCharacters: number): void {
    set({ score: deriveScoreState(builtCharacters) });
  },
});

export const selectScoreLevel = (state: ScoreSlice): ScoreLevel =>
  state.score.level;

export const selectPopulation = (state: ScoreSlice): number =>
  state.score.population;
