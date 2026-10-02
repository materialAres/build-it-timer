import type { AlarmProvider } from './alarm-adapter';
import { timerAlarmName } from './session';
import type { TimerState } from '@/store/store.types';

/**
 * Collaborators of the restore logic (principle D): the alarm scheduler and the
 * clock are injected, so the function is pure with respect to its dependencies
 * and testable without a browser (§1.4).
 */
export interface RestoreTimerDependencies {
  readonly alarmProvider: AlarmProvider;
  readonly now: () => number;
}

export interface RestoreTimerResult {
  /** The reconciled timer state (the same reference when nothing changed). */
  readonly timer: TimerState;
  /** True when the state differs from the persisted one and must be written. */
  readonly changed: boolean;
}

/**
 * Rebuild the timer after a service worker restart (M2.T2).
 *
 * The persisted store is the source of truth for *what* the session is, but not
 * for *how much time is left*: while the worker was asleep the countdown kept
 * running in wall-clock terms. The still-pending alarm is the only surviving
 * record of when the session was due to end, so the remaining time is
 * recomputed from it rather than trusted from the (stale) persisted value.
 *
 * Only a `running` timer is reconciled. `idle`/`paused` have no pending alarm by
 * construction (M2.T1 clears it on pause/reset), so they are returned untouched.
 *
 * Inconsistency handling (explicit, never silent): a `running` timer with no
 * pending alarm — or with a missing session id, which makes the alarm name
 * underivable — cannot be resumed. It is reverted to `paused` so the user can
 * restart it deliberately, instead of showing a countdown that no longer has a
 * backing alarm.
 */
export async function restoreTimer(
  timer: TimerState,
  dependencies: RestoreTimerDependencies,
): Promise<RestoreTimerResult> {
  if (timer.status !== 'running') {
    return { timer, changed: false };
  }

  const { alarmProvider, now } = dependencies;
  const { sessionId } = timer;

  if (sessionId === null) {
    return { timer: { ...timer, status: 'paused' }, changed: true };
  }

  const dueAt = await alarmProvider.getScheduledTime(timerAlarmName(sessionId));
  if (dueAt === undefined) {
    return { timer: { ...timer, status: 'paused' }, changed: true };
  }

  const remainingSeconds = Math.max(0, Math.round((dueAt - now()) / 1000));
  if (remainingSeconds === timer.remainingSeconds) {
    return { timer, changed: false };
  }

  return { timer: { ...timer, remainingSeconds }, changed: true };
}
