import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { SessionHistory } from '@/components/score/SessionHistory';
import { useAppStore, MAX_SESSION_HISTORY } from '@/store';
import type { SessionSummary } from '@/store/store.types';

function makeSummary(
  sessionId: string,
  score: SessionSummary['score'] = 'good',
  population = 20,
  endedAt = 0,
): SessionSummary {
  return { sessionId, score, population, endedAt };
}

function setHistory(sessions: ReadonlyArray<SessionSummary>): void {
  useAppStore.setState({ sessionHistory: { sessions } });
}

describe('SessionHistory (M3.T7)', () => {
  beforeEach(() => {
    setHistory([]);
  });

  afterEach(cleanup);

  it('renders an explicit empty state when there is no history', () => {
    render(<SessionHistory />);

    expect(screen.getByText('No completed sessions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.session-history__item')).toHaveLength(0);
  });

  it('renders a full 5-entry history in the stored (newest-first) order', () => {
    const sessions = Array.from({ length: MAX_SESSION_HISTORY }, (_, index) =>
      makeSummary(`session-${String(index)}`, 'excellent', index * 5),
    );
    setHistory(sessions);

    render(<SessionHistory />);

    const items = document.querySelectorAll('.session-history__item');
    expect(items).toHaveLength(MAX_SESSION_HISTORY);
    // The slice's order is preserved, not re-sorted: item N is session N.
    sessions.forEach((session, index) => {
      expect(items[index]).toHaveAttribute('data-session-id', session.sessionId);
    });
  });

  it('renders the score level from the stored value without recalculating it', () => {
    // distractionRatio 0 would derive 'excellent', but the stored summary says
    // 'bad': the component must trust the stored level, never recompute it.
    useAppStore.setState((state) => ({
      score: { ...state.score, level: 'excellent', distractionRatio: 0 },
      sessionHistory: { sessions: [makeSummary('finished', 'bad', 35)] },
    }));

    render(<SessionHistory />);

    const item = document.querySelector('.session-history__item');
    expect(item).toHaveAttribute('data-score', 'bad');
    expect(item).toHaveTextContent('Bad');
    expect(item).not.toHaveTextContent('Excellent');
  });

  it('shows the population and the score label of each session', () => {
    setHistory([makeSummary('a', 'good', 20), makeSummary('b', 'excellent', 5)]);

    render(<SessionHistory />);

    const items = document.querySelectorAll('.session-history__item');
    expect(items[0]).toHaveTextContent('20');
    expect(items[0]).toHaveAttribute('data-population', '20');
    expect(items[0]).toHaveTextContent('Good');
    expect(items[0]?.querySelector('.session-history__score')).toHaveClass(
      'session-history__score--good',
    );
    expect(items[1]).toHaveTextContent('Excellent');
  });

  it('reflects a newly recorded session between two consecutive renders', () => {
    render(<SessionHistory />);
    expect(screen.getByText('No completed sessions yet.')).toBeInTheDocument();

    act(() => {
      useAppStore.getState().recordSession(makeSummary('first', 'excellent', 15));
    });

    const items = document.querySelectorAll('.session-history__item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute('data-session-id', 'first');
    expect(screen.queryByText('No completed sessions yet.')).not.toBeInTheDocument();

    // A newer session lands at the front, preserving the slice's newest-first
    // contract instead of a component-side sort.
    act(() => {
      useAppStore.getState().recordSession(makeSummary('second', 'bad', 30));
    });

    const updated = document.querySelectorAll('.session-history__item');
    expect(updated).toHaveLength(2);
    expect(updated[0]).toHaveAttribute('data-session-id', 'second');
    expect(updated[1]).toHaveAttribute('data-session-id', 'first');
  });

  it('never renders a non-finite population', () => {
    setHistory([makeSummary('weird', 'good', Number.NaN)]);

    render(<SessionHistory />);

    const item = document.querySelector('.session-history__item');
    expect(item).toHaveAttribute('data-population', '0');
    expect(item).not.toHaveTextContent('NaN');
  });

  it('carries the CRT glow stylesheet and the per-level colors', () => {
    const { container } = render(<SessionHistory />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.session-history__item');
    expect(style?.textContent).toContain('.session-history__score--bad');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
