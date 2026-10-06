import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { PopulationCounter } from '@/components/score/PopulationCounter';
import { useAppStore } from '@/store';

function setPopulation(population: number): void {
  useAppStore.setState((state) => ({
    score: { ...state.score, population },
  }));
}

describe('PopulationCounter (M2.T18)', () => {
  beforeEach(() => {
    setPopulation(0);
  });

  afterEach(cleanup);

  it('renders the population from the store selector', () => {
    setPopulation(35);

    render(<PopulationCounter />);

    const counter = screen.getByRole('status');
    expect(counter).toHaveTextContent('35');
    expect(counter).toHaveAttribute('data-population', '35');
    expect(counter).toHaveAttribute('aria-label', 'Population: 35');
  });

  it('renders zero for an empty city', () => {
    render(<PopulationCounter />);

    const counter = screen.getByRole('status');
    expect(counter).toHaveTextContent('0');
    expect(counter).toHaveAttribute('data-population', '0');
  });

  it('reflects a population change between two consecutive renders', () => {
    render(<PopulationCounter />);
    expect(screen.getByRole('status')).toHaveTextContent('0');

    // The store notifies the subscribed component, so the same mounted node must
    // update without a remount.
    act(() => {
      setPopulation(20);
    });

    expect(screen.getByRole('status')).toHaveTextContent('20');
    expect(screen.getByRole('status')).toHaveAttribute('data-population', '20');
  });

  it('labels the counter and carries the CRT glow stylesheet', () => {
    const { container } = render(<PopulationCounter />);

    expect(screen.getByRole('status')).toHaveTextContent('population');
    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.population-counter');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
