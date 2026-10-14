import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '@/entrypoints/popup/App';
import { startBackground } from '@/entrypoints/background';
import { useAppStore, attachStoreSync, DEFAULT_FOCUS_SECONDS } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import type { CityLayers } from '@/components/city/city.types';

const T0 = 1_700_000_000_000;

/** Let the storage event → rehydrate chain (async) settle before asserting. */
const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function countOccupied(layers: CityLayers): number {
  return [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );
}

/**
 * M3.T4 — popup composition. The real background runs in-process with
 * `fakeBrowser` (the M1.T10 test pattern) and `<App />` renders against the
 * module-level `useAppStore` singleton, so the background's writes reach the
 * popup through the M1.T8 sync bridge — no injectable-store refactor.
 */
describe('popup App composition (M3.T4)', () => {
  let now: number;
  let handle: ReturnType<typeof startBackground>;

  beforeEach(async () => {
    fakeBrowser.reset();
    now = T0;

    // The popup's store is the module-level singleton, so the background is
    // started on it with the *real* alarm provider (backed by `fakeBrowser`):
    // the alarm is then fired through `fakeBrowser.alarms.onAlarm`, which is
    // what the provider subscribes to.
    const store = useAppStore;
    await store.persist.rehydrate();
    handle = startBackground({ store, now: () => now });
    await handle.ready;
    attachStoreSync(store);
    store.getState().setActiveTab('timer');
  });

  /** Fire the session alarm the way the browser would at the end of the countdown. */
  async function fireSessionAlarm(): Promise<void> {
    const sessionId = useAppStore.getState().timer.sessionId ?? '';
    now = T0 + DEFAULT_FOCUS_SECONDS * 1000;
    await act(async () => {
      await fakeBrowser.alarms.onAlarm.trigger({
        name: timerAlarmName(sessionId),
        scheduledTime: now,
        persistAcrossSessions: false,
      });
    });
    await flushAsync();
  }

  afterEach(() => {
    cleanup();
    handle.dispose();
  });

  it('renders the tab bar and the timer section by default', () => {
    render(<App />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText('00:25:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('counts the displayed timer down while the session runs (I001)', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    expect(screen.getByText('00:25:00')).toBeInTheDocument();

    // The popup projects the countdown from the session's end time, so moving
    // the deadline (as a background reconciliation would) immediately changes
    // the display without waiting for a background write.
    act(() => {
      const { timer } = useAppStore.getState();
      useAppStore.setState({
        timer: { ...timer, endsAt: Date.now() + 1495 * 1000 },
      });
    });

    expect(screen.getByText('00:24:55')).toBeInTheDocument();
  });

  it('shows one section at a time behind the tab bar', async () => {
    render(<App />);

    expect(screen.queryByRole('img', { name: /city/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));

    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('reaches every section from the single entry point', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));
    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Score' }));
    expect(screen.getByRole('status', { name: /score/i })).toBeInTheDocument();
    expect(screen.getByText('Last sessions')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    expect(screen.getByRole('group', { name: 'Presets' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Blocked sites' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Allowed sites' })).toBeInTheDocument();
  });

  it('starts the session from the UI and updates the display through the background', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    // The command travelled to the background (M3.T3b) and came back via sync.
    expect(useAppStore.getState().timer.status).toBe('running');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('grows the city after a simulated tick while the session runs', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    const empty = useAppStore.getState().city.layers;

    now = T0 + GROWTH_TICK_MS;
    await act(async () => {
      await fakeBrowser.runtime.sendMessage({
        type: 'TIMER_TICK',
        payload: { remainingSeconds: DEFAULT_FOCUS_SECONDS },
      });
    });

    expect(countOccupied(useAppStore.getState().city.layers)).toBe(1);
    expect(useAppStore.getState().city.layers).not.toBe(empty);
  });

  it('hides the export button during the session and shows it once completed', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));
    expect(screen.queryByRole('group', { name: /export/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    await fireSessionAlarm();

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));
    await waitFor(() => {
      expect(screen.getByRole('group', { name: /export/i })).toBeInTheDocument();
    });
  });

  it('records the completed session in the history shown by the score section', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    await fireSessionAlarm();

    await userEvent.click(screen.getByRole('tab', { name: 'Score' }));

    await waitFor(() => {
      expect(screen.queryByText('No completed sessions yet.')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('keeps the popup on the default tab after a remount (volatile field)', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Score' }));
    expect(useAppStore.getState().ui.activeTab).toBe('score');

    cleanup();
    useAppStore.getState().setActiveTab('timer');
    render(<App />);

    expect(screen.getByRole('tab', { name: 'Timer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
