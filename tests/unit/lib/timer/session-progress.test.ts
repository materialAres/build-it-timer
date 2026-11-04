import { describe, it, expect } from 'vitest';
import {
  advanceProgress,
  type AdvanceProgressOptions,
} from '@/lib/timer/session-progress';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;
const TICK_MS = 3_000;
const DURATION_MS = 1_500_000;

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
  return {
    distracted: false,
    tickMs: TICK_MS,
    durationMs: DURATION_MS,
    ...overrides,
  };
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
      // 15 000 ms of a 1 500 000 ms session worth 600 characters.
      builtCharacters: 6,
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
      // 6 focus characters minus 2 distraction characters (6 000 ms).
      builtCharacters: 4,
    });
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

  it('keeps the time and the score but derives no growth from an invalid cadence', () => {
    for (const tickMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const progress = advanceProgress(
        runningTimer(),
        T0 + TICK_MS,
        options({ tickMs }),
      );
      expect(progress?.focusedMs).toBe(TICK_MS);
      expect(progress?.lastAccountedAt).toBe(T0 + TICK_MS);
      expect(progress?.targetTicks).toBe(0);
      // Characters are counted from the duration, not from the cadence.
      expect(progress?.builtCharacters).toBe(1);
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

  it('counts exactly the total for a perfect session, whatever the cadence', () => {
    for (const tickMs of [TICK_MS, 2_500, 7_777]) {
      const progress = advanceProgress(
        runningTimer(),
        T0 + DURATION_MS,
        options({ tickMs }),
      );
      expect(progress?.builtCharacters).toBe(600);
    }
  });

  it('degrades an invalid duration to no built characters', () => {
    const progress = advanceProgress(
      runningTimer(),
      T0 + TICK_MS,
      options({ durationMs: 0 }),
    );
    expect(progress?.focusedMs).toBe(TICK_MS);
    expect(progress?.builtCharacters).toBe(0);
  });
});
