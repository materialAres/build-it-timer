import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useTimerTickEmitter } from '@/components/timer/use-timer-tick-emitter';
import { useAppStore, DEFAULT_FOCUS_SECONDS } from '@/store';
import { sendMessage } from '@/lib/messaging/bus';
import type { TimerState } from '@/store/store.types';

vi.mock('@/lib/messaging/bus', () => ({
  sendMessage: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
}));

const idleTimer: TimerState = {
  status: 'idle',
  remainingSeconds: DEFAULT_FOCUS_SECONDS,
  sessionStartedAt: null,
  sessionId: null,
  endsAt: null,
  focusedMs: 0,
};

function Probe() {
  useTimerTickEmitter();
  return null;
}

function setTimer(partial: Partial<TimerState>): void {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, ...partial } });
}

describe('useTimerTickEmitter (M3.T3b)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ timer: { ...idleTimer } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not emit while the session is idle', () => {
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('emits TIMER_TICK on the 2s cadence while running', () => {
    setTimer({ status: 'running', sessionId: 'session-1' });
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TIMER_TICK',
      payload: { remainingSeconds: DEFAULT_FOCUS_SECONDS },
    });
  });

  it('stops emitting when the session is paused', () => {
    setTimer({ status: 'running', sessionId: 'session-1' });
    render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    act(() => {
      setTimer({ status: 'paused' });
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('stops emitting on unmount', () => {
    setTimer({ status: 'running', sessionId: 'session-1' });
    const { unmount } = render(<Probe />);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
