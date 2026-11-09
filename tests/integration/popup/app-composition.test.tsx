import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '@/entrypoints/popup/App';
import { startBackground } from '@/entrypoints/background';
import { useAppStore, attachStoreSync, DEFAULT_FOCUS_SECONDS } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { tickMsForDurationSeconds } from '@/lib/timer/focus-presets';
import type { CityLayers } from '@/components/city/city.types';

const T0 = 1_700_000_000_000;
/** Cadence of the default preset the sessions start on. */
const TICK_MS = tickMsForDurationSeconds(DEFAULT_FOCUS_SECONDS);

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
    // The store is a module-level singleton shared by every test in this file:
    // a session or a chosen duration left by a previous test would leak into
    // this one, so start each from a clean idle timer on the default length.
    await store.getState().resetTimer();
    store.getState().setFocusDuration(DEFAULT_FOCUS_SECONDS);
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
    expect(screen.getByText('00:30:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('allows adding but not removing during a session and unlocks it on reset', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'facebook.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /added during a session.*timer reset/i,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove facebook.com' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Video preset,/ })).toBeEnabled();

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'instagram.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(
      screen.getByRole('button', { name: 'Remove instagram.com' }),
    ).toBeDisabled();
    expect(
      useAppStore.getState().blocklist.blocklist.map((e) => e.domain.value),
    ).toEqual(['facebook.com', 'instagram.com']);

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await flushAsync();

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove facebook.com' }),
    ).toBeEnabled();
  });

  it('summarises the blocklist under Start and opens the Blocklist tab (UI.T4)', async () => {
    // The singleton store keeps the list a previous test built.
    useAppStore.setState({
      blocklist: { blocklist: [], appliedPresetIds: [], userPresets: [] },
    });
    useAppStore.getState().setActiveTab('timer');
    render(<App />);

    expect(
      screen.getByRole('button', { name: 'No sites blocked' }),
    ).toBeInTheDocument();

    useAppStore.getState().addSite('facebook.com');
    expect(
      await screen.findByRole('button', {
        name: 'Blocks 1 site · add-only during a session',
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /^Blocks 1 site/ }),
    );

    expect(screen.getByRole('tab', { name: 'Blocklist' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Blocked sites' })).toBeVisible();
  });

  it('keeps the blocklist fully locked when the session completes', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    await fireSessionAlarm();
    expect(useAppStore.getState().timer.status).toBe('completed');

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /blocklist is locked.*reset the timer/i,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Video preset,/ })).toBeDisabled();
  });

  it('counts the displayed timer down while the session runs (I001)', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    expect(screen.getByText('00:30:00')).toBeInTheDocument();

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

    expect(
      screen.queryByRole('img', { name: /city/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));

    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start' }),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByRole('region', { name: 'Blocked sites' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Allowed sites' }),
    ).not.toBeInTheDocument();
  });

  it('shows each blocked site once, after the add form and the presets (UI.T1)', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('tab', { name: 'Blocklist' }));
    await userEvent.click(
      screen.getByRole('button', { name: /^Social preset,/ }),
    );
    await flushAsync();

    await waitFor(() => {
      expect(screen.getAllByText('instagram.com')).toHaveLength(1);
    });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    const input = screen.getByLabelText('Add to Blocked sites');
    const presets = screen.getByRole('group', { name: 'Presets' });
    const list = screen.getByRole('list', { name: 'Blocked sites entries' });
    expect(
      input.compareDocumentPosition(presets) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      presets.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it('changes the session length from the drum before starting (UI.T9)', async () => {
    render(<App />);
    const drum = screen.getByRole('spinbutton', { name: 'Focus duration' });
    expect(drum).toHaveAttribute('aria-valuenow', '30');

    drum.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(drum).toHaveAttribute('aria-valuenow', '10');
    await flushAsync();

    // The command reached the background (read-only popup) and came back via sync.
    await waitFor(() => {
      expect(useAppStore.getState().timer.durationSeconds).toBe(10 * 60);
    });
    expect(drum).toHaveAttribute('aria-valuenow', '10');
  });

  it('turns the drum into the clock while a session runs and back on reset (UI.T9)', async () => {
    render(<App />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '30');

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('00:30:00');

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await flushAsync();

    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '30');
  });

  it('grows the city after a simulated tick while the session runs', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    const empty = useAppStore.getState().city.layers;

    // The singleton store stamps the session start with its own clock (the
    // real one), so the tick is placed one session tick after that instant.
    const startedAt = useAppStore.getState().timer.sessionStartedAt ?? now;
    now = startedAt + TICK_MS;
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
    expect(
      screen.queryByRole('group', { name: /export/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    await fireSessionAlarm();

    await userEvent.click(screen.getByRole('tab', { name: 'City' }));
    await waitFor(() => {
      expect(
        screen.getByRole('group', { name: /export/i }),
      ).toBeInTheDocument();
    });
  });

  it('leaves only Reset active once the session completes', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();
    await fireSessionAlarm();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });

  it('records the completed session in the history shown by the score section', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await flushAsync();

    await fireSessionAlarm();

    await userEvent.click(screen.getByRole('tab', { name: 'Score' }));

    await waitFor(() => {
      expect(
        screen.queryByText('No completed sessions yet.'),
      ).not.toBeInTheDocument();
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
