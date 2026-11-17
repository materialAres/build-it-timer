import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { CityPanel } from '@/components/city/CityPanel';
import { selectCityPlan, useAppStore } from '@/store';

const mocks = vi.hoisted(() => ({
  webgl: true,
  freeCamera: false,
  onUnavailable: null as (() => void) | null,
  holdProbe: false,
  pending: null as (() => void) | null,
  released: 0,
}));

vi.mock('@/components/city/webgl-support', () => ({
  probeWebGl2: () => (mocks.webgl ? { take: () => null, release: () => { mocks.released += 1; } } : null),
  // The probe waits for the first paint; the tests run it at once unless they hold it.
  afterFirstPaint: (work: () => void) => {
    if (mocks.holdProbe) { mocks.pending = work; return () => { mocks.pending = null; }; }
    work();
    return () => undefined;
  },
}));
vi.mock('@/components/city/CityView3D', () => ({
  default: ({ onUnavailable, freeCamera }: { onUnavailable?: () => void; freeCamera?: boolean }) => {
    mocks.onUnavailable = onUnavailable ?? null;
    mocks.freeCamera = freeCamera === true;
    return <div data-testid="view-3d" />;
  },
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
  beforeEach(() => {
    mocks.webgl = true;
    mocks.onUnavailable = null;
    mocks.freeCamera = false;
    mocks.holdProbe = false;
    mocks.pending = null;
    mocks.released = 0;
    setCity(null, 0);
  });
  afterEach(cleanup);

  it('is a stage with a label that holds the 3D view, loaded lazily', async () => {
    render(<CityPanel />);
    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
    expect(await screen.findByTestId('view-3d')).toBeInTheDocument();
  });

  it('shows the loading line at once, before the WebGL check and while the 3D view loads (#22)', async () => {
    mocks.holdProbe = true;
    setCity('session-a', 300);
    const { container } = render(<CityPanel />);
    expect(screen.getByText('LOADING CITY…')).toBeInTheDocument();
    expect(container.querySelector('.city-fallback')).toBeNull();
    expect(screen.queryByTestId('view-3d')).not.toBeInTheDocument();
    act(() => { mocks.pending?.(); });
    expect(await screen.findByTestId('view-3d')).toBeInTheDocument();
    expect(screen.queryByText('LOADING CITY…')).not.toBeInTheDocument();
  });

  it('releases an unused probe when the panel goes away (#22)', async () => {
    const { unmount } = render(<CityPanel />);
    await screen.findByTestId('view-3d');
    unmount();
    expect(mocks.released).toBe(1);
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

  describe('without the 3D view (CR6.T8b)', () => {
    it('shows the text city and never requests the 3D chunk when WebGL2 is missing', () => {
      mocks.webgl = false;
      setCity('session-a', 300);
      const { container } = render(<CityPanel />);
      expect(screen.queryByTestId('view-3d')).not.toBeInTheDocument();
      expect(container.querySelector('.city-fallback')?.textContent).toMatch(/#/);
      expect(screen.getByText(/3D view unavailable here/)).toBeInTheDocument();
    });

    it('keeps the label, the HUD line and the same summary', () => {
      mocks.webgl = false;
      setCity('session-a', 300);
      render(<CityPanel />);
      expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
      expect(screen.getByText(/FLOORS$/)).toBeInTheDocument();
      expect(summary()).toMatch(/^City: \d+ of \d+ floors built/);
    });

    it('switches to the text city when the view reports that WebGL failed or the context was lost', async () => {
      setCity('session-a', 300);
      const { container } = render(<CityPanel />);
      await screen.findByTestId('view-3d');
      expect(container.querySelector('.city-fallback')).toBeNull();
      act(() => { mocks.onUnavailable?.(); });
      expect(screen.queryByTestId('view-3d')).not.toBeInTheDocument();
      expect(container.querySelector('.city-fallback')).not.toBeNull();
      expect(screen.getByText(/3D view unavailable here/)).toBeInTheDocument();
    });

    it('shows no note while the 3D view works', async () => {
      render(<CityPanel />);
      await screen.findByTestId('view-3d');
      expect(screen.queryByText(/3D view unavailable here/)).not.toBeInTheDocument();
    });
  });

  describe('full page (CR6.T11)', () => {
    it('is the same stage with the free camera and a full-size class', async () => {
      const { container } = render(<CityPanel full />);
      await screen.findByTestId('view-3d');
      expect(container.querySelector('.city-stage')).toHaveClass('city-stage--full');
      expect(mocks.freeCamera).toBe(true);
    });

    it('keeps the popup stage and the limited camera by default', async () => {
      const { container } = render(<CityPanel />);
      await screen.findByTestId('view-3d');
      expect(container.querySelector('.city-stage')).not.toHaveClass('city-stage--full');
      expect(mocks.freeCamera).toBe(false);
    });

    it('keeps the label, the HUD line and the summary', async () => {
      setCity('session-a', 300);
      render(<CityPanel full />);
      await screen.findByTestId('view-3d');
      expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
      expect(screen.getByText(/FLOORS$/)).toBeInTheDocument();
      expect(summary()).toMatch(/^City: \d+ of \d+ floors built/);
    });
  });
});
