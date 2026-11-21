import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { CityFallback } from '@/components/city/CityFallback';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { renderSkyline, SKYLINE_ROWS } from '@/lib/city/plan/plan-skyline';

function setCity(sessionId: string | null, built: number): void {
  act(() => {
    useAppStore.setState((state) => ({
      city: { ...state.city, sessionId },
      score: { ...state.score, builtCharacters: built },
    }));
  });
}
const text = (container: HTMLElement): string => container.querySelector('pre')?.textContent ?? '';

describe('CityFallback (CR6.T8b)', () => {
  beforeEach(() => { setCity(null, 0); });
  afterEach(cleanup);

  it('draws the same plan and visible floors as the 3D view', () => {
    setCity('session-fallback', 300);
    const { container } = render(<CityFallback />);
    const state = useAppStore.getState();
    const plan = selectCityPlan(state);
    if (plan === null) throw new Error('no plan');
    expect(text(container)).toBe(renderSkyline(plan, selectVisibleFloors(state)).join('\n'));
    expect(text(container).split('\n')).toHaveLength(SKYLINE_ROWS);
  });

  it('grows with the score', () => {
    setCity('session-fallback', 150);
    const { container } = render(<CityFallback />);
    const before = text(container);
    setCity('session-fallback', 450);
    expect(text(container)).not.toBe(before);
  });

  it('is empty before there is a city and hidden from assistive technology', () => {
    const { container } = render(<CityFallback />);
    expect(text(container)).toBe('');
    expect(container.querySelector('pre')).toHaveAttribute('aria-hidden', 'true');
  });
});
