import type { StateCreator } from 'zustand';
import type { TimerState, TimerStatus } from './store.types';
import type { AppState } from '.';

export interface TimerSlice {
  readonly timer: TimerState;
}

const initialTimerState: TimerState = {
  status: 'idle',
  remainingSeconds: 25 * 60,
  sessionStartedAt: null,
  sessionId: null,
};

export const createTimerSlice: StateCreator<AppState, [], [], TimerSlice> = () => ({
  timer: { ...initialTimerState },
});

export const selectTimer = (state: TimerSlice): TimerState => state.timer;

export const selectTimerStatus = (state: TimerSlice): TimerStatus => state.timer.status;

export const selectRemainingSeconds = (state: TimerSlice): number =>
  state.timer.remainingSeconds;

export const selectSessionId = (state: TimerSlice): string | null =>
  state.timer.sessionId;
