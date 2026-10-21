import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useCountdownEstimate } from '@/components/timer/use-countdown-estimate';
import { useAppStore } from '@/store';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;
/** Length of the fixture session; the tests hardcode it in the projections. */
const SESSION_SECONDS = 1500;

const idleTimer: TimerState = {
  status: 'idle',
  durationSeconds: SESSION_SECONDS,
  remainingSeconds: SESSION_SECONDS,
  sessionStartedAt: null,
  sessionId: null,
  endsAt: null,
  focusedMs: 0,
  distractedMs: 0,
};

function Probe() {
  useCountdownEstimate();
  return null;
}

function setTimer(partial: Partial<TimerState>): void {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, ...partial } });
}

describe('useCountdownEstimate (I001)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    useAppStore.setState({ timer: { ...idleTimer } });
    useAppStore.getState().setLiveRemainingSeconds(SESSION_SECONDS);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('publishes the persisted value while idle', () => {
    render(<Probe />);

    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(SESSION_SECONDS);
  });

  it('counts down once per second while running', () => {
    setTimer({
      status: 'running',
      sessionId: 'session-1',
      endsAt: T0 + 1500 * 1000,
    });
    render(<Probe />);

    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1500);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1499);

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1495);
  });

  it('freezes the estimate when the session is paused', () => {
    setTimer({
      status: 'running',
      sessionId: 'session-1',
      endsAt: T0 + 1500 * 1000,
    });
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1498);

    act(() => {
      setTimer({ status: 'paused', endsAt: null });
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // The paused value is the persisted one, not a projection.
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1500);
  });

  it('stops the interval on unmount', () => {
    setTimer({
      status: 'running',
      sessionId: 'session-1',
      endsAt: T0 + 1500 * 1000,
    });
    const { unmount } = render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1499);

    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1499);
  });

  it('re-derives from the store so a background reconciliation self-corrects', () => {
    setTimer({
      status: 'running',
      sessionId: 'session-1',
      endsAt: T0 + 1500 * 1000,
    });
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(1499);

    // The background re-arms the session (e.g. after a restart): the estimate
    // must follow the new deadline instead of drifting. One second has already
    // elapsed, so the projection is 899s.
    act(() => {
      setTimer({ endsAt: T0 + 900 * 1000 });
    });

    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(899);
  });

  it('reaches zero at the deadline and never goes negative', () => {
    setTimer({
      status: 'running',
      sessionId: 'session-1',
      endsAt: T0 + 3 * 1000,
    });
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(useAppStore.getState().ui.liveRemainingSeconds).toBe(0);
  });
});
