import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ScoreBadge, SCORE_BADGE_LABELS } from '@/components/score/ScoreBadge';
import { useAppStore } from '@/store';
import type { ScoreLevel } from '@/store/store.types';

function setScore(level: ScoreLevel, distractionRatio = 0): void {
  useAppStore.setState({ score: { level, distractionRatio } });
}

describe('ScoreBadge (M2.T17)', () => {
  beforeEach(() => {
    setScore('excellent');
  });

  afterEach(cleanup);

  it('renders the excellent variant from the store level', () => {
    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Excellent');
    expect(badge).toHaveClass('score-badge--excellent');
    expect(badge).toHaveAttribute('data-level', 'excellent');
  });

  it('renders the good variant from the store level', () => {
    setScore('good', 0.3);

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Good');
    expect(badge).toHaveClass('score-badge--good');
    expect(badge).toHaveAttribute('data-level', 'good');
  });

  it('renders the bad variant from the store level', () => {
    setScore('bad', 0.5);

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Bad');
    expect(badge).toHaveClass('score-badge--bad');
    expect(badge).toHaveAttribute('data-level', 'bad');
  });

  it('reflects a transition from excellent to bad between two consecutive renders', () => {
    render(<ScoreBadge />);

    expect(screen.getByRole('status')).toHaveTextContent('Excellent');
    expect(screen.getByRole('status')).toHaveClass('score-badge--excellent');

    // The store notifies the subscribed component, so the same mounted node
    // must switch both its label and its variant class without a remount.
    act(() => {
      setScore('bad', 0.5);
    });

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Bad');
    expect(badge).toHaveClass('score-badge--bad');
    expect(badge).not.toHaveClass('score-badge--excellent');
  });

  it('gives each level a distinct label and modifier class', () => {
    const levels: readonly ScoreLevel[] = ['excellent', 'good', 'bad'];

    const labels = levels.map((level) => SCORE_BADGE_LABELS[level]);

    expect(new Set(labels).size).toBe(levels.length);
    expect(labels).toEqual(['Excellent', 'Good', 'Bad']);
  });

  it('carries the per-level color stylesheet', () => {
    const { container } = render(<ScoreBadge />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.score-badge--excellent');
    expect(style?.textContent).toContain('.score-badge--good');
    expect(style?.textContent).toContain('.score-badge--bad');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
