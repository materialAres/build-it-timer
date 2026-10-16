import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { TimerControls } from '@/components/timer/TimerControls';
import { useAppStore, DEFAULT_FOCUS_SECONDS } from '@/store';
import type { TimerState } from '@/store/store.types';

const idleTimer: TimerState = {
  status: 'idle',
  remainingSeconds: DEFAULT_FOCUS_SECONDS,
  sessionStartedAt: null,
  sessionId: null,
  endsAt: null,
  focusedMs: 0,
  distractedMs: 0,
};

function setTimer(partial: Partial<TimerState>): void {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, ...partial } });
}

describe('TimerDisplay (M2.T3)', () => {
  beforeEach(() => {
    useAppStore.setState({ timer: { ...idleTimer } });
    useAppStore.getState().setLiveRemainingSeconds(DEFAULT_FOCUS_SECONDS);
  });

  afterEach(cleanup);

  it('renders the live countdown estimate as hh:mm:ss', () => {
    useAppStore.getState().setLiveRemainingSeconds(65);

    render(<TimerDisplay />);

    expect(screen.getByText('00:01:05')).toBeInTheDocument();
  });

  it('renders 00:00:00 when the countdown reaches zero', () => {
    useAppStore.getState().setLiveRemainingSeconds(0);

    render(<TimerDisplay />);

    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders values beyond one hour', () => {
    useAppStore.getState().setLiveRemainingSeconds(3661);

    render(<TimerDisplay />);

    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });
});

describe('TimerControls (M2.T3)', () => {
  beforeEach(() => {
    useAppStore.setState({ timer: { ...idleTimer } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requests the start transition when Start is clicked (M3.T3b)', async () => {
    const requestStartTimer = vi
      .spyOn(useAppStore.getState(), 'requestStartTimer')
      .mockImplementation(() => {});

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(requestStartTimer).toHaveBeenCalledTimes(1);
  });

  it('requests the pause transition when Pause is clicked (M3.T3b)', async () => {
    setTimer({ status: 'running', sessionId: 'session-1' });
    const requestPauseTimer = vi
      .spyOn(useAppStore.getState(), 'requestPauseTimer')
      .mockImplementation(() => {});

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(requestPauseTimer).toHaveBeenCalledTimes(1);
  });

  it('requests the reset transition when Reset is clicked (M3.T3b)', async () => {
    setTimer({ status: 'paused', sessionId: 'session-1' });
    const requestResetTimer = vi
      .spyOn(useAppStore.getState(), 'requestResetTimer')
      .mockImplementation(() => {});

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(requestResetTimer).toHaveBeenCalledTimes(1);
  });

  it('disables Start while running and Pause/Reset while idle', () => {
    render(<TimerControls />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('disables Start and enables Pause/Reset while running', () => {
    setTimer({ status: 'running', sessionId: 'session-1' });

    render(<TimerControls />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });
});
