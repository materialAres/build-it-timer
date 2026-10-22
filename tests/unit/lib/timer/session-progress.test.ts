import { describe, it, expect } from 'vitest';
import {
  advanceProgress,
  type AdvanceProgressOptions,
} from '@/lib/timer/session-progress';
import { calculatePopulation } from '@/lib/score/calculate-population';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;
const TICK_MS = 3_000;

function runningTimer(overrides: Partial<TimerState> = {}): TimerState {
  return {
    status: 'running',
    durationSeconds: 1_500,
    remainingSeconds: 1_500,
    sessionStartedAt: T0,
    sessionId: 'session-1',
    endsAt: T0 + 1_500_000,
    focusedMs: 0,
    distractedMs: 0,
    lastAccountedAt: T0,
    ...overrides,
  };
}

function options(
  overrides: Partial<AdvanceProgressOptions> = {},
): AdvanceProgressOptions {
  return { distracted: false, tickMs: TICK_MS, ...overrides };
}

describe('advanceProgress (M2.T15/M2.T18 catch-up)', () => {
  it('is a no-op unless the timer is running', () => {
    for (const status of ['idle', 'paused', 'completed'] as const) {
      expect(
        advanceProgress(runningTimer({ status }), T0 + TICK_MS, options()),
      ).toBeUndefined();
    }
  });

  it('is a no-op without a checkpoint (an old persisted snapshot)', () => {
    expect(
      advanceProgress(
        runningTimer({ lastAccountedAt: null }),
        T0 + TICK_MS,
        options(),
      ),
    ).toBeUndefined();
  });

  it('is a no-op for a non-positive or non-finite delta', () => {
    expect(advanceProgress(runningTimer(), T0, options())).toBeUndefined();
    expect(advanceProgress(runningTimer(), T0 - 1, options())).toBeUndefined();
    expect(
      advanceProgress(runningTimer(), Number.NaN, options()),
    ).toBeUndefined();
    expect(
      advanceProgress(
        runningTimer({ lastAccountedAt: Number.NaN }),
        T0 + 1,
        options(),
      ),
    ).toBeUndefined();
  });

  it('credits the whole elapsed focus stretch and advances the checkpoint', () => {
    const progress = advanceProgress(
      runningTimer({ focusedMs: TICK_MS }),
      T0 + TICK_MS * 4,
      options(),
    );

    expect(progress).toEqual({
      focusedMs: TICK_MS * 5,
      distractedMs: 0,
      lastAccountedAt: T0 + TICK_MS * 4,
      targetTicks: 5,
      population: calculatePopulation(TICK_MS * 5, 0, TICK_MS),
    });
  });

  it('books a distracted stretch as penalty time, not focus', () => {
    const progress = advanceProgress(
      runningTimer({ focusedMs: TICK_MS * 5, distractedMs: 0 }),
      T0 + TICK_MS * 2,
      options({ distracted: true }),
    );

    expect(progress).toEqual({
      focusedMs: TICK_MS * 5,
      distractedMs: TICK_MS * 2,
      lastAccountedAt: T0 + TICK_MS * 2,
      targetTicks: 5,
      population: calculatePopulation(TICK_MS * 5, TICK_MS * 2, TICK_MS),
    });
    // Net loss: the city already has 5 ticks, the population drops by 2.
    expect(progress?.population).toBe((5 - 2) * 5);
  });

  it('caps the credited stretch at endsAt (no time past the deadline)', () => {
    const endsAt = T0 + TICK_MS * 3;
    const progress = advanceProgress(
      runningTimer({ endsAt }),
      endsAt + 60 * 60_000,
      options(),
    );

    expect(progress?.lastAccountedAt).toBe(endsAt);
    expect(progress?.focusedMs).toBe(TICK_MS * 3);
    expect(progress?.targetTicks).toBe(3);
  });

  it('keeps the time but derives no reward from an invalid cadence', () => {
    for (const tickMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const progress = advanceProgress(
        runningTimer(),
        T0 + TICK_MS,
        options({ tickMs }),
      );
      expect(progress?.focusedMs).toBe(TICK_MS);
      expect(progress?.lastAccountedAt).toBe(T0 + TICK_MS);
      expect(progress?.targetTicks).toBe(0);
      expect(progress?.population).toBe(0);
    }
  });

  it('clamps untrusted accumulator values instead of leaking NaN', () => {
    const progress = advanceProgress(
      runningTimer({ focusedMs: Number.NaN, distractedMs: -5 }),
      T0 + TICK_MS,
      options(),
    );

    expect(progress?.focusedMs).toBe(TICK_MS);
    expect(progress?.distractedMs).toBe(0);
  });

  it('is idempotent: applying the result and accounting again credits nothing', () => {
    const now = T0 + TICK_MS;
    const first = advanceProgress(runningTimer(), now, options());
    expect(first).toBeDefined();
    if (first === undefined) return;

    const applied = runningTimer({
      focusedMs: first.focusedMs,
      distractedMs: first.distractedMs,
      lastAccountedAt: first.lastAccountedAt,
    });
    expect(advanceProgress(applied, now, options())).toBeUndefined();
  });
});
