import type { StateCreator } from 'zustand';
import type { AlarmProvider } from '@/lib/timer/alarm-adapter';
import { generateSessionId, timerAlarmName } from '@/lib/timer/session';
import type { TimerState, TimerStatus } from './store.types';
import type { AppState } from '.';

/** Default focus session length, in seconds (25 minutes). */
export const DEFAULT_FOCUS_SECONDS = 25 * 60;

/**
 * Injected collaborators of the slice (principle D). The slice never imports
 * `browser.alarms` (M2.T1 acceptance criterion) and never reads the wall clock
 * or `Math.random()` on its own, so it stays pure and testable in isolation
 * (§1.4).
 */
export interface TimerDependencies {
  /** Scheduler that owns the countdown's persistence (M1.T5). */
  readonly alarmProvider: AlarmProvider;
  /** Clock used to stamp `sessionStartedAt` and the alarm's due time. */
  readonly now: () => number;
  /** Entropy source for session ids; injectable for deterministic tests. */
  readonly random: () => number;
}

export interface TimerSlice {
  readonly timer: TimerState;
  /**
   * Begin a focus session, or resume a paused one. Idempotent while already
   * `running`; from `paused` it re-arms the countdown without resetting it.
   */
  startTimer(): Promise<void>;
  /** Suspend a running countdown and cancel its pending alarm. */
  pauseTimer(): Promise<void>;
  /** Return to the initial idle state and cancel any pending alarm. */
  resetTimer(): Promise<void>;
}

const initialTimerState: TimerState = {
  status: 'idle',
  remainingSeconds: DEFAULT_FOCUS_SECONDS,
  sessionStartedAt: null,
  sessionId: null,
};

/**
 * Timer state and actions (M2.T1). `remainingSeconds` is the single source of
 * truth for the countdown; the UI derives hh:mm:ss from it (M2.T3) instead of
 * keeping separate hour/minute/second fields.
 *
 * The alarm is scheduled at the *absolute* time the countdown reaches zero, so
 * the background (M2.T2) can rebuild the timer after a service worker restart
 * from the persisted state plus the still-pending alarm. The 60s platform
 * minimum tick (M1.T5) is honored by the provider, not here.
 */
export function createTimerSlice(
  dependencies: TimerDependencies,
): StateCreator<AppState, [], [], TimerSlice> {
  const { alarmProvider, now, random } = dependencies;

  return (set, get) => ({
    timer: { ...initialTimerState },

    async startTimer(): Promise<void> {
      const { timer } = get();

      // Idempotent while running: re-arming on every call would let the alarm's
      // due time drift away from the countdown it is supposed to represent.
      if (timer.status === 'running') return;

      if (timer.status === 'paused') {
        const { sessionId } = timer;
        set({ timer: { ...timer, status: 'running' } });
        if (sessionId !== null) {
          await alarmProvider.schedule(
            timerAlarmName(sessionId),
            now() + timer.remainingSeconds * 1000,
          );
        }
        return;
      }

      // Idle: a brand-new session, always with a fresh id so the previous
      // session's alarm can never be confused with this one.
      const startedAt = now();
      const sessionId = generateSessionId(startedAt, random);
      set({
        timer: {
          status: 'running',
          remainingSeconds: timer.remainingSeconds,
          sessionStartedAt: startedAt,
          sessionId,
        },
      });
      await alarmProvider.schedule(
        timerAlarmName(sessionId),
        startedAt + timer.remainingSeconds * 1000,
      );
    },

    async pauseTimer(): Promise<void> {
      const { timer } = get();

      // Pausing something that is not running has no consistent meaning: it is a
      // safe no-op rather than a transition into an undefined state.
      if (timer.status !== 'running') return;

      const { sessionId } = timer;
      set({ timer: { ...timer, status: 'paused' } });
      if (sessionId !== null) {
        await alarmProvider.clear(timerAlarmName(sessionId));
      }
    },

    async resetTimer(): Promise<void> {
      const { sessionId } = get().timer;
      set({ timer: { ...initialTimerState } });
      // Cancel by the *previous* session's name: after the reset the store no
      // longer remembers which alarm was pending.
      if (sessionId !== null) {
        await alarmProvider.clear(timerAlarmName(sessionId));
      }
    },
  });
}

export const selectTimer = (state: TimerSlice): TimerState => state.timer;

export const selectTimerStatus = (state: TimerSlice): TimerStatus => state.timer.status;

export const selectRemainingSeconds = (state: TimerSlice): number =>
  state.timer.remainingSeconds;

export const selectSessionId = (state: TimerSlice): string | null =>
  state.timer.sessionId;
