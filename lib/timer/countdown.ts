import type { TimerState } from '@/store/store.types';

/**
 * The popup-side countdown estimate (I001).
 *
 * `browser.alarms` is the single source of truth for the session's persistence
 * (M1.T5/M2.T2), but it cannot tick faster than once per minute and the session
 * alarm is one-shot, so the background never rewrites `remainingSeconds` while
 * the countdown runs. A read-only context (the popup, M1.T9) therefore derives
 * the displayed value from the session's absolute end time instead of waiting
 * for a write that will not come.
 *
 * Pure and total (§1.4): the clock is a parameter, never read internally, and
 * every non-finite input degrades to the persisted value rather than leaking
 * `NaN` into the render.
 */
export function estimateRemainingSeconds(
  timer: TimerState,
  nowMs: number,
): number {
  // Only a running countdown has an end time to project from. `paused` keeps
  // the frozen value (the alarm was cleared, so there is nothing to project),
  // and `idle`/`completed` keep theirs too.
  if (timer.status !== 'running') return timer.remainingSeconds;
  if (timer.endsAt === null) return timer.remainingSeconds;
  if (!Number.isFinite(nowMs) || !Number.isFinite(timer.endsAt)) {
    return timer.remainingSeconds;
  }

  // Ceil, not round: the countdown should show "1s left" for the whole last
  // second and only reach 0 when the deadline has actually passed.
  const remaining = Math.ceil((timer.endsAt - nowMs) / 1000);
  return Math.max(0, remaining);
}
