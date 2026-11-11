import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { CityPanel } from '@/components/city/CityPanel';
import { selectCityPlan, useAppStore } from '@/store';

vi.mock('@/components/city/CityView3D', () => ({
  default: () => <div data-testid="view-3d" />,
}));

function setCity(sessionId: string | null, built: number): void {
  act(() => {
    useAppStore.setState((state) => ({
      city: { ...state.city, sessionId },
      score: { ...state.score, builtCharacters: built },
    }));
  });
}
const summary = (): string => screen.getByRole('status').textContent;

describe('CityPanel (CR6.T8a)', () => {
  beforeEach(() => { setCity(null, 0); });
  afterEach(cleanup);

  it('is a stage with a label that holds the 3D view, loaded lazily', async () => {
    render(<CityPanel />);
    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
    expect(screen.getByText('LOADING CITY…')).toBeInTheDocument();
    expect(await screen.findByTestId('view-3d')).toBeInTheDocument();
    expect(screen.queryByText('LOADING CITY…')).not.toBeInTheDocument();
  });

  it('is not a keyboard trap: nothing in the stage takes focus', async () => {
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    const stage = screen.getByRole('img', { name: /city/i });
    expect(stage.querySelector('[tabindex], button, a, input, canvas')).toBeNull();
  });

  it('says nothing is built before a session and shows no HUD line', async () => {
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    expect(summary()).toBe('City: nothing built yet.');
    expect(screen.queryByText(/FLOORS/)).not.toBeInTheDocument();
  });

  it('shows the live floors in the HUD and describes the city for screen readers', async () => {
    setCity('session-a', 300);
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    const plan = selectCityPlan(useAppStore.getState());
    const total = plan?.totalFloors ?? 0;
    expect(screen.getByText(new RegExp(`^> \\d+/${String(total)} FLOORS$`))).toBeInTheDocument();
    expect(summary()).toMatch(new RegExp(`^City: \\d+ of ${String(total)} floors built\\. Buildings standing: \\d+\\. Tallest`));
  });

  it('announces at milestones only, not once per floor', async () => {
    setCity('session-a', 120);
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    const first = summary();
    setCity('session-a', 121);
    setCity('session-a', 124);
    expect(summary()).toBe(first);
    setCity('session-a', 180);
    expect(summary()).not.toBe(first);
  });

  it('keeps the HUD live between milestones', async () => {
    setCity('session-a', 120);
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    const before = screen.getByText(/FLOORS$/).textContent;
    setCity('session-a', 126);
    await waitFor(() => { expect(screen.getByText(/FLOORS$/).textContent).not.toBe(before); });
  });

  it('announces a new city at once, even at the same milestone', async () => {
    setCity('session-a', 120);
    render(<CityPanel />);
    await screen.findByTestId('view-3d');
    const first = summary();
    setCity('session-b', 120);
    expect(summary()).not.toBe(first);
  });
});
