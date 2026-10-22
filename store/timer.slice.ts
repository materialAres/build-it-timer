import type { StateCreator } from 'zustand';
import type { AlarmProvider } from '@/lib/timer/alarm-adapter';
import {
  DEFAULT_FOCUS_PRESET,
  isPresetDurationSeconds,
} from '@/lib/timer/focus-presets';
import { generateSessionId, timerAlarmName } from '@/lib/timer/session';
import type { MessagingDependencies } from '@/lib/messaging/mutation-sender';
import type { TimerState, TimerStatus } from './store.types';
import type { AppState } from '.';

/**
 * Default focus session length, in seconds. Kept as a named export for existing
 * callers; it now derives from {@link DEFAULT_FOCUS_PRESET} (the centralized
 * preset table) instead of a hard-coded 25 minutes.
 */
export const DEFAULT_FOCUS_SECONDS = DEFAULT_FOCUS_PRESET.durationSeconds;

/**
 * Injected collaborators of the slice (principle D). The slice never imports
 * `browser.alarms` (M2.T1 acceptance criterion) and never reads the wall clock
 * or `Math.random()` on its own, so it stays pure and testable in isolation
 * (§1.4).
 */
export interface TimerDependencies extends MessagingDependencies {
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
  /**
   * Mark the session as finished (M3.T3c): the countdown reached zero, so the
   * timer leaves `running` for `completed` and the pending alarm is cleared.
   *
   * `completed` is deliberately distinct from `paused` (a finished session is
   * not resumable — `remainingSeconds` is zero) and from `idle` (which is
   * indistinguishable from "never started" and would leave the popup unable to
   * tell that a session just ended, M3.T4).
   */
  completeTimer(): Promise<void>;
  /**
   * Record undistracted focus time accumulated by the growth tracker
   * (M2.T15/M2.T18). The tracker measures the running-only elapsed time on
   * each sampling tick and hands the running total here; the field is persisted so
   * the accumulator survives a service worker restart mid-session. A
   * non-finite or negative value degrades to 0 (§1.4).
   */
  recordFocusedMs(focusedMs: number): void;
  /**
   * Record distraction time accumulated on blocked sites by the tab tracker
   * (M2.T16/M2.T18). Same contract as {@link recordFocusedMs}: the tracker
   * measures it, the slice only stores it, and the field is persisted so the
   * population penalty survives a restart. A non-finite or negative value
   * degrades to 0 (§1.4).
   */
  recordDistractedMs(distractedMs: number): void;
  /**
   * Persist one accounting step produced by `advanceProgress` (M2.T15/M2.T18):
   * the two running-only accumulators and the new wall-clock checkpoint. The
   * background calls it on every wake (tick, progress alarm, restart) so a gap
   * with no sampling ticks is still credited. One `set` for all three fields
   * keeps it a single persist. Non-finite/negative totals degrade to 0 (§1.4).
   */
  recordProgress(
    focusedMs: number,
    distractedMs: number,
    lastAccountedAt: number,
  ): void;
  /**
   * Change the session length to one of the offered presets. Only legal while
   * the timer is idle or completed: changing it mid-run would desync `endsAt`,
   * the pending alarm and the growth cadence. An unknown or non-preset value is
   * ignored (§1.4 defensive boundary).
   */
  setFocusDuration(durationSeconds: number): void;
  /**
   * Ask the background (the timer's owner) to change the session length
   * (read-only popup, M1.T9). The popup's answer arrives through the M1.T8 sync
   * bridge, exactly like the other timer commands.
   */
  requestSetDuration(durationSeconds: number): void;
  /**
   * Ask the background to start/resume the session (M3.T3b). A read-only
   * context (the popup, M1.T9) must not run `startTimer` locally: that would
   * mutate only its own in-memory copy and schedule the alarm on its own
   * provider, while the background — which owns the timer, the alarms and the
   * DNR rules — would never learn about the session.
   */
  requestStartTimer(): void;
  /** Ask the background to pause the session (M3.T3b). */
  requestPauseTimer(): void;
  /** Ask the background to reset the session (M3.T3b). */
  requestResetTimer(): void;
}

const initialTimerState: TimerState = {
  status: 'idle',
  durationSeconds: DEFAULT_FOCUS_SECONDS,
  remainingSeconds: DEFAULT_FOCUS_SECONDS,
  sessionStartedAt: null,
  sessionId: null,
  endsAt: null,
  focusedMs: 0,
  distractedMs: 0,
  lastAccountedAt: null,
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
  const { alarmProvider, now, random, sendMutation } = dependencies;

  return (set, get) => ({
    timer: { ...initialTimerState },

    async startTimer(): Promise<void> {
      const { timer } = get();

      // Idempotent while running: re-arming on every call would let the alarm's
      // due time drift away from the countdown it is supposed to represent.
      if (timer.status === 'running') return;

      // A completed session has no remaining time and is not resumable: its
      // whole duration has elapsed. Starting it again would create a
      // zero-length session, so Reset is the only way back to `idle`.
      if (timer.status === 'completed') return;

      if (timer.status === 'paused') {
        const { sessionId } = timer;
        // Resuming re-arms the countdown from *now*, so the projected end time
        // moves with it (I001): the popup estimates from this value.
        const resumedAt = now();
        const endsAt = resumedAt + timer.remainingSeconds * 1000;
        // The accumulated focus time is kept: a resume continues the same
        // session's city and population, it does not restart them. The
        // checkpoint is (re)initialized by the background on the running
        // transition, so it uses the same clock as the accounting step.
        set({
          timer: {
            ...timer,
            status: 'running',
            endsAt,
            lastAccountedAt: null,
          },
        });
        if (sessionId !== null) {
          await alarmProvider.schedule(timerAlarmName(sessionId), endsAt);
        }
        return;
      }

      // Idle: a brand-new session, always with a fresh id so the previous
      // session's alarm can never be confused with this one.
      const startedAt = now();
      const sessionId = generateSessionId(startedAt, random);
      const endsAt = startedAt + timer.remainingSeconds * 1000;
      // Every focus session starts from a brand-new city (roadmap M2.T11): the
      // reset is invoked here, on the idle → running transition only, never on a
      // resume, so pausing/resuming keeps the city the user has already built.
      get().resetCityForNewSession(sessionId);
      set({
        timer: {
          status: 'running',
          durationSeconds: timer.durationSeconds,
          remainingSeconds: timer.remainingSeconds,
          sessionStartedAt: startedAt,
          sessionId,
          endsAt,
          // A brand-new session starts with an empty focus accumulator; the
          // previous session's total must not bleed into the new city. The
          // background initializes the checkpoint when it observes `running`.
          focusedMs: 0,
          distractedMs: 0,
          lastAccountedAt: null,
        },
      });
      await alarmProvider.schedule(timerAlarmName(sessionId), endsAt);
    },

    async pauseTimer(): Promise<void> {
      const { timer } = get();

      // Pausing something that is not running has no consistent meaning: it is a
      // safe no-op rather than a transition into an undefined state.
      if (timer.status !== 'running') return;

      const { sessionId } = timer;
      // Pausing freezes the countdown: the alarm is cleared, so there is no
      // deadline left to project from (I001). The *actual* remaining time is
      // persisted here, otherwise the frozen display would jump back to the
      // session's full duration (the background never rewrites the countdown
      // while it runs).
      const remainingSeconds =
        timer.endsAt === null
          ? timer.remainingSeconds
          : Math.max(0, Math.ceil((timer.endsAt - now()) / 1000));
      set({
        timer: {
          ...timer,
          status: 'paused',
          remainingSeconds,
          endsAt: null,
          lastAccountedAt: null,
        },
      });
      if (sessionId !== null) {
        await alarmProvider.clear(timerAlarmName(sessionId));
      }
    },

    async resetTimer(): Promise<void> {
      const { sessionId, durationSeconds } = get().timer;
      // Reset returns to the *selected* duration, not a fixed default, so the
      // user's choice survives a reset (the cadence keys off it too).
      set({
        timer: {
          ...initialTimerState,
          durationSeconds,
          remainingSeconds: durationSeconds,
        },
      });
      // Cancel by the *previous* session's name: after the reset the store no
      // longer remembers which alarm was pending.
      if (sessionId !== null) {
        await alarmProvider.clear(timerAlarmName(sessionId));
      }
    },

    async completeTimer(): Promise<void> {
      const { timer } = get();

      // Only a running session can complete: a stale alarm firing after a pause
      // or a reset must not resurrect a finished state.
      if (timer.status !== 'running') return;

      const { sessionId } = timer;
      set({
        timer: {
          status: 'completed',
          durationSeconds: timer.durationSeconds,
          remainingSeconds: 0,
          sessionStartedAt: timer.sessionStartedAt,
          sessionId,
          endsAt: null,
          // The session's focus total stays readable after completion (the
          // summary and the population are derived from it, M3.T3c).
          focusedMs: timer.focusedMs,
          distractedMs: timer.distractedMs,
          // No running stretch is open any more; the background accounts the
          // final interval before calling this action.
          lastAccountedAt: null,
        },
      });
      // The alarm has already fired, but clearing is idempotent and keeps the
      // "no pending alarm outside a running session" invariant (M2.T2) true.
      if (sessionId !== null) {
        await alarmProvider.clear(timerAlarmName(sessionId));
      }
    },

    recordFocusedMs(focusedMs: number): void {
      const { timer } = get();
      // Guard the untrusted boundary (§1.4): the tracker is an injected
      // collaborator, so a non-finite or negative total degrades to 0 instead
      // of leaking into the persisted state.
      const safe = Number.isFinite(focusedMs) ? Math.max(0, focusedMs) : 0;
      if (safe === timer.focusedMs) return;
      set({ timer: { ...timer, focusedMs: safe } });
    },

    recordDistractedMs(distractedMs: number): void {
      const { timer } = get();
      const safe = Number.isFinite(distractedMs)
        ? Math.max(0, distractedMs)
        : 0;
      if (safe === timer.distractedMs) return;
      set({ timer: { ...timer, distractedMs: safe } });
    },

    recordProgress(
      focusedMs: number,
      distractedMs: number,
      lastAccountedAt: number,
    ): void {
      const { timer } = get();
      // Guard the untrusted boundary (§1.4): these values come from a helper
      // fed by the injected clock, so a non-finite total must not reach the
      // persisted state/render.
      const safeFocused = Number.isFinite(focusedMs)
        ? Math.max(0, focusedMs)
        : 0;
      const safeDistracted = Number.isFinite(distractedMs)
        ? Math.max(0, distractedMs)
        : 0;
      if (!Number.isFinite(lastAccountedAt)) return;
      if (
        safeFocused === timer.focusedMs &&
        safeDistracted === timer.distractedMs &&
        lastAccountedAt === timer.lastAccountedAt
      ) {
        return;
      }
      set({
        timer: {
          ...timer,
          focusedMs: safeFocused,
          distractedMs: safeDistracted,
          lastAccountedAt,
        },
      });
    },

    setFocusDuration(durationSeconds: number): void {
      const { timer } = get();
      // Changing the length mid-session would desync the projected end time, the
      // pending alarm and the growth cadence: it is a no-op outside idle/completed.
      if (timer.status === 'running' || timer.status === 'paused') return;
      if (!isPresetDurationSeconds(durationSeconds)) return;
      if (timer.durationSeconds === durationSeconds) return;
      set({
        timer: {
          ...timer,
          durationSeconds,
          // A new idle session shows the chosen length; `remainingSeconds` is
          // derived from it until the countdown starts.
          remainingSeconds: durationSeconds,
        },
      });
    },

    // The request actions never touch the local state: the popup's copy is
    // read-only (M1.T9) and the background's answer arrives through the M1.T8
    // sync bridge, so the UI converges on the state the owner actually applied.
    requestSetDuration(durationSeconds: number): void {
      sendMutation?.({
        type: 'TIMER_SET_DURATION',
        payload: { durationSeconds },
      });
    },

    requestStartTimer(): void {
      sendMutation?.({ type: 'TIMER_STARTED', payload: {} });
    },

    requestPauseTimer(): void {
      sendMutation?.({ type: 'TIMER_PAUSED', payload: {} });
    },

    requestResetTimer(): void {
      sendMutation?.({ type: 'TIMER_RESET', payload: {} });
    },
  });
}

export const selectTimer = (state: TimerSlice): TimerState => state.timer;

export const selectTimerStatus = (state: TimerSlice): TimerStatus =>
  state.timer.status;

export const selectRemainingSeconds = (state: TimerSlice): number =>
  state.timer.remainingSeconds;

export const selectSessionId = (state: TimerSlice): string | null =>
  state.timer.sessionId;
