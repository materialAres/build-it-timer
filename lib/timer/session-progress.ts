import type { TimerState } from '@/store/store.types';
import { calculatePopulation } from '@/lib/score/calculate-population';

/**
 * The accumulators and derived values a completed accounting step produces.
 * `focusedMs`/`distractedMs` remain the single source of truth; the tick target
 * and the population are pure projections of them (M2.T15/M2.T18).
 */
export interface SessionProgress {
  readonly focusedMs: number;
  readonly distractedMs: number;
  /** New checkpoint: the instant up to which time has been accounted for. */
  readonly lastAccountedAt: number;
  /** Absolute growth target: `floor(focusedMs / tickMs)`. */
  readonly targetTicks: number;
  /** Live population for the same measures. */
  readonly population: number;
}

export interface AdvanceProgressOptions {
  /**
   * Whether the whole stretch since the checkpoint was spent on a blocked site.
   * The caller supplies the current observation; the city does not grow while
   * distracted and the population books the time as a penalty instead.
   */
  readonly distracted: boolean;
  /** Session cadence in ms (`lib/timer/focus-presets.ts`). */
  readonly tickMs: number;
}

/**
 * Advance a running session's accumulators by the wall-clock time elapsed since
 * its persisted checkpoint.
 *
 * This is the fix for the "city/population freeze when the popup is closed"
 * bug: progress is no longer the sum of UI sampling ticks. Whenever the
 * background gets to run — a `TIMER_TICK`, the 60s progress alarm, a worker
 * wake-up or a timer command — the whole gap is credited at once. Because the
 * output is derived from the *total* time, repeated calls are idempotent and a
 * long gap cannot be lost or double-counted.
 *
 * The stretch is capped at `endsAt`: waking hours after the session ended must
 * not credit time past the deadline. A paused/idle/completed timer, a missing
 * checkpoint (an old persisted snapshot) or a non-positive delta is a no-op.
 *
 * Pure and total (principle D / §1.4): the clock is a parameter, inputs are
 * guarded, and a non-finite/negative `tickMs` degrades to "no derived reward"
 * rather than leaking `NaN`.
 */
export function advanceProgress(
  timer: TimerState,
  nowMs: number,
  options: AdvanceProgressOptions,
): SessionProgress | undefined {
  if (timer.status !== 'running') return undefined;
  if (timer.lastAccountedAt === null) return undefined;
  if (!Number.isFinite(nowMs) || !Number.isFinite(timer.lastAccountedAt)) {
    return undefined;
  }

  const endsAt =
    timer.endsAt !== null && Number.isFinite(timer.endsAt)
      ? timer.endsAt
      : null;
  const until = endsAt === null ? nowMs : Math.min(nowMs, endsAt);
  const elapsed = until - timer.lastAccountedAt;
  if (!(elapsed > 0)) return undefined;

  // Clamp untrusted accumulator values, mirroring the timer slice guards.
  const focusedBefore = Number.isFinite(timer.focusedMs)
    ? Math.max(0, timer.focusedMs)
    : 0;
  const distractedBefore = Number.isFinite(timer.distractedMs)
    ? Math.max(0, timer.distractedMs)
    : 0;

  const focusedMs = options.distracted
    ? focusedBefore
    : focusedBefore + elapsed;
  const distractedMs = options.distracted
    ? distractedBefore + elapsed
    : distractedBefore;

  // An invalid cadence has no meaningful ticks: keep the time (so the
  // checkpoint advances) but derive no growth or population for it.
  const tickMs =
    Number.isFinite(options.tickMs) && options.tickMs > 0
      ? options.tickMs
      : Number.POSITIVE_INFINITY;

  return {
    focusedMs,
    distractedMs,
    lastAccountedAt: until,
    targetTicks:
      tickMs === Number.POSITIVE_INFINITY ? 0 : Math.floor(focusedMs / tickMs),
    population: calculatePopulation(focusedMs, distractedMs, tickMs),
  };
}
