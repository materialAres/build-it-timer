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
};

function setTimer(partial: Partial<TimerState>): void {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, ...partial } });
}

describe('TimerDisplay (M2.T3)', () => {
  beforeEach(() => {
    useAppStore.setState({ timer: { ...idleTimer } });
  });

  afterEach(cleanup);

  it('renders remainingSeconds as hh:mm:ss', () => {
    setTimer({ remainingSeconds: 65 });

    render(<TimerDisplay />);

    expect(screen.getByText('00:01:05')).toBeInTheDocument();
  });

  it('renders 00:00:00 when the countdown reaches zero', () => {
    setTimer({ remainingSeconds: 0 });

    render(<TimerDisplay />);

    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders values beyond one hour', () => {
    setTimer({ remainingSeconds: 3661 });

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

  it('invokes the store startTimer action when Start is clicked', async () => {
    const startTimer = vi.spyOn(useAppStore.getState(), 'startTimer').mockResolvedValue();

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(startTimer).toHaveBeenCalledTimes(1);
  });

  it('invokes the store pauseTimer action when Pause is clicked', async () => {
    setTimer({ status: 'running', sessionId: 'session-1' });
    const pauseTimer = vi.spyOn(useAppStore.getState(), 'pauseTimer').mockResolvedValue();

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(pauseTimer).toHaveBeenCalledTimes(1);
  });

  it('invokes the store resetTimer action when Reset is clicked', async () => {
    setTimer({ status: 'paused', sessionId: 'session-1' });
    const resetTimer = vi.spyOn(useAppStore.getState(), 'resetTimer').mockResolvedValue();

    render(<TimerControls />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(resetTimer).toHaveBeenCalledTimes(1);
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
