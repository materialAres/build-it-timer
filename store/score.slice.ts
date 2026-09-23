import type { StateCreator } from 'zustand';
import type { ScoreLevel } from './store.types';
import type { AppState } from '.';

export interface ScoreSlice {
  readonly score: {
    readonly level: ScoreLevel;
    readonly distractionRatio: number;
  };
}

const initialScoreState: ScoreSlice['score'] = {
  level: 'excellent',
  distractionRatio: 0,
};

export const createScoreSlice: StateCreator<AppState, [], [], ScoreSlice> = () => ({
  score: { ...initialScoreState },
});

export const selectScoreLevel = (state: ScoreSlice): ScoreLevel =>
  state.score.level;

export const selectDistractionRatio = (state: ScoreSlice): number =>
  state.score.distractionRatio;
