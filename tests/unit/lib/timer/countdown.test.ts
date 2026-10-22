import { describe, it, expect } from 'vitest';
import { estimateRemainingSeconds } from '@/lib/timer/countdown';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;

const running: TimerState = {
  status: 'running',
  durationSeconds: 1500,
  remainingSeconds: 1500,
  sessionStartedAt: T0,
  sessionId: 'session-1',
  endsAt: T0 + 1500 * 1000,
  focusedMs: 0,
  distractedMs: 0,
  lastAccountedAt: T0,
};

describe('estimateRemainingSeconds (I001)', () => {
  it('projects the countdown from the session end time', () => {
    expect(estimateRemainingSeconds(running, T0)).toBe(1500);
    expect(estimateRemainingSeconds(running, T0 + 1_000)).toBe(1499);
    expect(estimateRemainingSeconds(running, T0 + 60_000)).toBe(1440);
  });

  it('counts down once per second', () => {
    const values = [0, 1_000, 2_000, 3_000].map((offset) =>
      estimateRemainingSeconds(running, T0 + offset),
    );
    expect(values).toEqual([1500, 1499, 1498, 1497]);
  });

  it('keeps the last second visible until the deadline passes', () => {
    // Ceil semantics: 1s left is shown for the whole final second.
    expect(estimateRemainingSeconds(running, T0 + 1499 * 1000)).toBe(1);
    expect(estimateRemainingSeconds(running, T0 + 1499_500)).toBe(1);
    expect(estimateRemainingSeconds(running, T0 + 1500 * 1000)).toBe(0);
  });

  it('clamps to zero once the deadline has passed', () => {
    expect(estimateRemainingSeconds(running, T0 + 1500 * 1000 + 1)).toBe(0);
    expect(estimateRemainingSeconds(running, T0 + 10_000_000)).toBe(0);
  });

  it('returns the persisted value for a paused timer (frozen countdown)', () => {
    const paused: TimerState = { ...running, status: 'paused', endsAt: null };
    expect(estimateRemainingSeconds(paused, T0 + 60_000)).toBe(1500);
  });

  it('returns the persisted value for idle and completed timers', () => {
    const idle: TimerState = { ...running, status: 'idle', endsAt: null };
    const completed: TimerState = {
      ...running,
      status: 'completed',
      remainingSeconds: 0,
      endsAt: null,
    };
    expect(estimateRemainingSeconds(idle, T0 + 60_000)).toBe(1500);
    expect(estimateRemainingSeconds(completed, T0 + 60_000)).toBe(0);
  });

  it('falls back to the persisted value when there is no end time', () => {
    const noEnd: TimerState = { ...running, endsAt: null };
    expect(estimateRemainingSeconds(noEnd, T0 + 60_000)).toBe(1500);
  });

  it('degrades to the persisted value on non-finite input', () => {
    expect(estimateRemainingSeconds(running, Number.NaN)).toBe(1500);
    expect(estimateRemainingSeconds(running, Number.POSITIVE_INFINITY)).toBe(1500);
    expect(
      estimateRemainingSeconds({ ...running, endsAt: Number.NaN }, T0),
    ).toBe(1500);
  });

  it('is pure: the same inputs always yield the same value', () => {
    expect(estimateRemainingSeconds(running, T0 + 5_000)).toBe(
      estimateRemainingSeconds(running, T0 + 5_000),
    );
  });
});
