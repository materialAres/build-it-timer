import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CityEmptyHint } from '@/components/city/CityEmptyHint';
import { useAppStore } from '@/store';

function setState(status: 'idle' | 'running' | 'completed', built: number): void {
  act(() => {
    useAppStore.setState((state) => ({
      timer: { ...state.timer, status },
      score: { ...state.score, builtCharacters: built },
    }));
  });
}

describe('CityEmptyHint (UI.T7)', () => {
  beforeEach(() => {
    setState('idle', 0);
  });
  afterEach(cleanup);

  it('explains how the city grows while nothing is built and no session runs', () => {
    render(<CityEmptyHint />);

    expect(
      screen.getByText('Your city grows while you focus. Start a session to build it.'),
    ).toBeInTheDocument();
  });

  it('goes away once a session is running', () => {
    setState('running', 0);
    render(<CityEmptyHint />);

    expect(screen.queryByText(/your city grows/i)).not.toBeInTheDocument();
  });

  it('stays away when a finished city exists', () => {
    setState('idle', 120);
    render(<CityEmptyHint />);

    expect(screen.queryByText(/your city grows/i)).not.toBeInTheDocument();
  });
});
