import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ScoreBadge, scoreLevelLabel } from '@/components/score/ScoreBadge';
import { useAppStore } from '@/store';
import type { ScoreLevel } from '@/store/store.types';

function setScore(level: ScoreLevel, builtCharacters = 300): void {
  useAppStore.setState((state) => ({
    score: { ...state.score, level, builtCharacters },
    timer: { ...state.timer, status: 'running' },
  }));
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

  it('renders the great variant from the store level', () => {
    setScore('great');

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Great');
    expect(badge).toHaveClass('score-badge--great');
    expect(badge).toHaveAttribute('data-level', 'great');
  });

  it('renders the good variant from the store level', () => {
    setScore('good');

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Good');
    expect(badge).toHaveClass('score-badge--good');
    expect(badge).toHaveAttribute('data-level', 'good');
  });

  it('renders the bad variant from the store level', () => {
    setScore('bad');

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Bad');
    expect(badge).toHaveClass('score-badge--bad');
    expect(badge).toHaveAttribute('data-level', 'bad');
  });

  it('shows a neutral early state instead of Bad in the first moments', () => {
    setScore('bad', 0);

    render(<ScoreBadge />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Starting');
    expect(badge).toHaveClass('score-badge--early');
    expect(badge).toHaveAttribute('data-level', 'early');
    expect(badge).not.toHaveTextContent('Bad');
  });

  it('shows Bad once a tenth of the session is built', () => {
    setScore('bad', 60);

    render(<ScoreBadge />);

    expect(screen.getByRole('status')).toHaveTextContent('Bad');
  });

  it('shows the real tier of a finished session even when little was built', () => {
    setScore('bad', 12);
    act(() => {
      useAppStore.setState((state) => ({ timer: { ...state.timer, status: 'completed' } }));
    });

    render(<ScoreBadge />);

    expect(screen.getByRole('status')).toHaveTextContent('Bad');
  });

  it('reflects a transition from excellent to bad between two consecutive renders', () => {
    render(<ScoreBadge />);

    expect(screen.getByRole('status')).toHaveTextContent('Excellent');
    expect(screen.getByRole('status')).toHaveClass('score-badge--excellent');

    // The store notifies the subscribed component, so the same mounted node
    // must switch both its label and its variant class without a remount.
    act(() => {
      setScore('bad');
    });

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('Bad');
    expect(badge).toHaveClass('score-badge--bad');
    expect(badge).not.toHaveClass('score-badge--excellent');
  });

  it('gives each level a distinct label and modifier class', () => {
    const levels: readonly ScoreLevel[] = ['excellent', 'great', 'good', 'bad'];

    const labels = levels.map((level) => scoreLevelLabel(level));

    expect(new Set(labels).size).toBe(levels.length);
    expect(labels).toEqual(['Excellent', 'Great', 'Good', 'Bad']);
  });

  it('carries the per-level color stylesheet', () => {
    const { container } = render(<ScoreBadge />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.score-badge--excellent');
    expect(style?.textContent).toContain('.score-badge--great');
    expect(style?.textContent).toContain('.score-badge--good');
    expect(style?.textContent).toContain('.score-badge--bad');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
