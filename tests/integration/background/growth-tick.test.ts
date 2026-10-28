import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createAppStore, selectPopulation } from '@/store';
import { growCityByTicks, seedFromSession } from '@/lib/city/growth-engine';
import { calculatePopulation } from '@/lib/score/calculate-population';
import {
  DEFAULT_FOCUS_PRESET,
  tickMsForDurationSeconds,
} from '@/lib/timer/focus-presets';
import { ALARM_MIN_TICK_MS } from '@/lib/timer/alarm-adapter';
import { TIMER_PROGRESS_ALARM } from '@/lib/timer/session';
import type { CityLayers } from '@/components/city/city.types';

const T0 = 1_700_000_000_000;
/** Cadence of the default preset: a session tick, not the legacy 2s constant. */
const TICK_MS = tickMsForDurationSeconds(DEFAULT_FOCUS_PRESET.durationSeconds);

function countOccupied(layers: CityLayers): number {
  return [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );
}

describe('growth linked to the timer tick (M2.T15)', () => {
  let now: number;
  let alarmProvider: FakeAlarmProvider;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function startWiredBackground() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now });
    return { store, handle };
  }

  async function tick(remainingSeconds = 1_500): Promise<void> {
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds } });
  }

  it('grows the city by the undistracted elapsed delta on each tick while running', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    const empty = store.getState().city.layers;
    const seed = seedFromSession(store.getState().city.sessionId);

    // First tick, one session tick of focus after the session started.
    now = T0 + TICK_MS;
    await tick();
    let expected = growCityByTicks(empty, 1, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(1);

    // Second tick: another single character, never a block.
    now = T0 + TICK_MS * 2;
    await tick();
    expected = growCityByTicks(expected, 1, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(2);

    handle.dispose();
  });

  it('does not grow the city when a tick arrives while paused', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    now = T0 + TICK_MS;
    await tick();
    await store.getState().pauseTimer();
    const frozen = store.getState().city.layers;

    // Ticks keep arriving (a naive emitter) but the paused interval is not focus.
    now = T0 + TICK_MS * 10;
    await tick();

    expect(store.getState().city.layers).toBe(frozen);
    handle.dispose();
  });

  it('does not grow the city on a tick while idle', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    const before = store.getState().city.layers;
    now = T0 + TICK_MS * 3;
    await tick();

    expect(store.getState().city.layers).toBe(before);
    handle.dispose();
  });

  it('does not grow for a sub-tick delta (less than one session tick of focus)', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    const empty = store.getState().city.layers;

    now = T0 + TICK_MS - 1;
    await tick();

    expect(store.getState().city.layers).toBe(empty);
    handle.dispose();
  });

  it('does not count the paused gap after resume', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    const empty = store.getState().city.layers;
    const seed = seedFromSession(store.getState().city.sessionId);

    now = T0 + TICK_MS;
    await tick();
    await store.getState().pauseTimer();

    // Ten seconds pass paused, then the session resumes.
    now = T0 + TICK_MS * 5;
    await store.getState().startTimer();
    now = T0 + TICK_MS * 6;
    await tick();

    // Only the two running stretches count, not the paused gap.
    const expected = growCityByTicks(growCityByTicks(empty, 1, seed), 1, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(2);
    handle.dispose();
  });
});

describe('population linked to the timer tick (M2.T18 live update)', () => {
  const T0 = 1_700_000_000_000;

  let now: number;
  let alarmProvider: FakeAlarmProvider;
  /** Drives the fake tab source's `onUpdated` listener from a test. */
  let reflectTabUpdate: (url: string | undefined) => void;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function startWiredBackground() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now });
    return { store, handle };
  }

  async function tick(remainingSeconds = 1_500): Promise<void> {
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds } });
  }

  /** Start a session and let `ms` of focus elapse through the session cadence. */
  async function runFocused(ms: number): Promise<number> {
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const ticks = Math.floor(ms / TICK_MS);
    for (let t = 1; t <= ticks; t += 1) {
      now = T0 + t * TICK_MS;
      await tick();
    }
    return ticks;
  }

  it('grows the population with the focused time while running', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    // 10 minutes of focus: one +5 batch per completed session tick.
    const ticks = await runFocused(10 * 60_000);
    expect(selectPopulation(store.getState())).toBe(
      calculatePopulation(ticks * TICK_MS, 0, TICK_MS),
    );
    expect(selectPopulation(store.getState())).toBe(ticks * 5);

    handle.dispose();
  });

  it('adds 5 inhabitants every session tick while running', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    expect(selectPopulation(store.getState())).toBe(0);

    now = T0 + TICK_MS;
    await tick();
    expect(selectPopulation(store.getState())).toBe(5);

    now = T0 + TICK_MS * 2;
    await tick();
    expect(selectPopulation(store.getState())).toBe(10);

    now = T0 + TICK_MS * 3;
    await tick();
    expect(selectPopulation(store.getState())).toBe(15);

    handle.dispose();
  });

  it('does not change the population on a tick while paused or idle', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runFocused(6 * 60_000);
    const afterFocus = selectPopulation(store.getState());
    expect(afterFocus).toBeGreaterThan(0);

    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
    now = T0 + 10 * 60_000;
    await tick();
    expect(selectPopulation(store.getState())).toBe(afterFocus);

    await sendMessage({ type: 'TIMER_RESET', payload: {} });
    now = T0 + 12 * 60_000;
    await tick();
    expect(selectPopulation(store.getState())).toBe(afterFocus);

    handle.dispose();
  });

  it('does not write the store when the population value did not change', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runFocused(6 * 60_000);
    const afterTicks = store.getState().score;

    // A sub-tick delta completes no new session tick, so the population is
    // unchanged and the slice must keep the same reference (no persist/re-render).
    now = T0 + 6 * 60_000 + TICK_MS - 1;
    await tick();
    expect(store.getState().score).toBe(afterTicks);

    handle.dispose();
  });

  it('restores the accumulated focus time after a service worker restart', async () => {
    const { handle } = startWiredBackground();
    await handle.ready;

    await runFocused(6 * 60_000);
    const before = selectPopulation(handle.store.getState());
    handle.dispose();

    // Simulated restart: a brand-new background over the same persisted state.
    const restartedStore = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const restarted = startBackground({
      store: restartedStore,
      alarmProvider,
      now: () => now,
    });
    await restarted.ready;

    // The accumulator survived, so the population continues from where it was
    // instead of restarting at zero.
    expect(selectPopulation(restartedStore.getState())).toBe(before);

    now += TICK_MS;
    await tick();
    expect(selectPopulation(restartedStore.getState())).toBe(before + 5);

    restarted.dispose();
  });

  it('decreases the population while a blocked site is open and pauses the city', async () => {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    // A fake tab source we can drive: opening a blocked tab marks the user as
    // distracted (M2.T16), which the growth tick must treat as non-focus time.
    let blockedUrl: string | undefined;
    const handle = startBackground({
      store,
      alarmProvider,
      now: () => now,
      tabEventSource: {
        queryTabs: () => Promise.resolve([{ id: 1, url: blockedUrl }]),
        onUpdated: (listener) => {
          reflectTabUpdate = (url) => {
            blockedUrl = url;
            listener({ id: 1, url });
          };
          return () => {};
        },
        onRemoved: () => () => {},
      },
    });
    await handle.ready;

    // Block a site and apply it, then start the session.
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });

    // Two clean focus ticks: +5 each.
    now = T0 + TICK_MS;
    await tick();
    now = T0 + TICK_MS * 2;
    await tick();
    expect(selectPopulation(store.getState())).toBe(10);
    const cityBefore = store.getState().city.layers;

    // Navigate to the blocked site: the elapsed stretch is now distraction.
    reflectTabUpdate('https://x.com/feed');
    now = T0 + TICK_MS * 3;
    await tick();
    expect(selectPopulation(store.getState())).toBe(5);

    now = T0 + TICK_MS * 4;
    await tick();
    expect(selectPopulation(store.getState())).toBe(0);

    // The city did not grow during the distracted stretch.
    expect(store.getState().city.layers).toBe(cityBefore);

    handle.dispose();
  });

  it('pays back the accumulated distraction before growing again', async () => {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    let blockedUrl: string | undefined;
    const handle = startBackground({
      store,
      alarmProvider,
      now: () => now,
      tabEventSource: {
        queryTabs: () => Promise.resolve([{ id: 1, url: blockedUrl }]),
        onUpdated: (listener) => {
          reflectTabUpdate = (url) => {
            blockedUrl = url;
            listener({ id: 1, url });
          };
          return () => {};
        },
        onRemoved: () => () => {},
      },
    });
    await handle.ready;

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'x.com' },
    });
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });

    // Distracted from the start: two ticks of penalty, clamped at zero.
    reflectTabUpdate('https://x.com/feed');
    now = T0 + TICK_MS;
    await tick();
    now = T0 + TICK_MS * 2;
    await tick();
    expect(selectPopulation(store.getState())).toBe(0);

    // Back to a safe page. The counter is focus ticks minus distraction ticks,
    // so the two ticks of distraction debt are paid back first: still 0 after
    // one and two focus ticks...
    reflectTabUpdate('https://example.com/');
    now = T0 + TICK_MS * 3;
    await tick();
    expect(selectPopulation(store.getState())).toBe(0);

    now = T0 + TICK_MS * 4;
    await tick();
    expect(selectPopulation(store.getState())).toBe(0);

    // ...and the population grows again from the third focus tick onward.
    now = T0 + TICK_MS * 5;
    await tick();
    expect(selectPopulation(store.getState())).toBe(5);

    now = T0 + TICK_MS * 6;
    await tick();
    expect(selectPopulation(store.getState())).toBe(10);

    handle.dispose();
  });
});

/**
 * Regression suite for the "city and population freeze when the popup is
 * closed / the browser loses focus" bug. Progress must be derived from the
 * persisted wall-clock checkpoint, so a gap with no `TIMER_TICK` is recovered
 * by the next background wake-up (a tick, the progress heartbeat or a restart).
 */
describe('wall-clock catch-up (closed popup / worker restart)', () => {
  const T0 = 1_700_000_000_000;

  let now: number;
  let alarmProvider: FakeAlarmProvider;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function startWiredBackground() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now });
    return { store, handle };
  }

  async function startSession(): Promise<void> {
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
  }

  async function tick(): Promise<void> {
    await sendMessage({
      type: 'TIMER_TICK',
      payload: { remainingSeconds: 1_500 },
    });
  }

  it('catches up the whole gap after the popup stops emitting ticks', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    await startSession();

    // One sampled tick, then the popup is closed: no TIMER_TICK for 10 ticks.
    now = T0 + TICK_MS;
    await tick();
    expect(countOccupied(store.getState().city.layers)).toBe(1);

    now = T0 + TICK_MS * 11;
    await tick();

    // The next wake-up credits the entire gap instead of restarting at "now".
    expect(countOccupied(store.getState().city.layers)).toBe(11);
    expect(store.getState().timer.focusedMs).toBe(TICK_MS * 11);
    expect(selectPopulation(store.getState())).toBe(11 * 5);

    handle.dispose();
  });

  it('catches up across a worker restart while the popup stays closed', async () => {
    const { handle } = startWiredBackground();
    await handle.ready;
    await startSession();

    now = T0 + TICK_MS;
    await tick();
    const before = selectPopulation(handle.store.getState());
    handle.dispose();

    // Four more cadence units pass with no popup at all; a fresh worker wakes.
    now = T0 + TICK_MS * 5;
    const restartedStore = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    await restartedStore.persist.rehydrate();
    const restarted = startBackground({
      store: restartedStore,
      alarmProvider,
      now: () => now,
    });
    await restarted.ready;

    expect(countOccupied(restartedStore.getState().city.layers)).toBe(5);
    expect(selectPopulation(restartedStore.getState())).toBe(before + 4 * 5);

    restarted.dispose();
  });

  it('credits the trailing stretch before a pause instead of dropping it', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    await startSession();

    // 2.5 ticks of running with no sampled tick in between.
    now = T0 + TICK_MS * 2 + Math.floor(TICK_MS / 2);
    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });

    expect(store.getState().timer.focusedMs).toBe(now - T0);
    expect(store.getState().timer.lastAccountedAt).toBeNull();
    expect(countOccupied(store.getState().city.layers)).toBe(2);
    expect(selectPopulation(store.getState())).toBe(10);

    // Paused time is still never credited.
    const focusedAtPause = store.getState().timer.focusedMs;
    now += TICK_MS * 5;
    await tick();
    expect(store.getState().timer.focusedMs).toBe(focusedAtPause);

    handle.dispose();
  });

  it('does not credit time past the session deadline', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    await startSession();

    const sessionMs = DEFAULT_FOCUS_PRESET.durationSeconds * 1000;
    now = T0 + sessionMs + 10 * 60_000;
    await tick();

    expect(store.getState().timer.focusedMs).toBe(sessionMs);
    expect(store.getState().timer.lastAccountedAt).toBe(T0 + sessionMs);
    expect(selectPopulation(store.getState())).toBe(
      calculatePopulation(sessionMs, 0, TICK_MS),
    );
    // The city may saturate before the tick target (its grid is finite), but it
    // must never grow past what the capped focus time is worth.
    const occupied = countOccupied(store.getState().city.layers);
    expect(occupied).toBeGreaterThan(0);
    expect(occupied).toBeLessThanOrEqual(Math.floor(sessionMs / TICK_MS));

    handle.dispose();
  });

  it('advances on the background heartbeat with no popup tick, and stops on pause', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    await startSession();

    // No TIMER_TICK: only the 60s progress alarm fires.
    now = T0 + ALARM_MIN_TICK_MS;
    const fired = alarmProvider.advanceBy(ALARM_MIN_TICK_MS);
    expect(fired).toContain(TIMER_PROGRESS_ALARM);

    const completedTicks = Math.floor(ALARM_MIN_TICK_MS / TICK_MS);
    expect(countOccupied(store.getState().city.layers)).toBe(completedTicks);
    expect(selectPopulation(store.getState())).toBe(completedTicks * 5);
    // Re-armed for the next minute while the session keeps running.
    expect(alarmProvider.getScheduledWhen(TIMER_PROGRESS_ALARM)).toBe(
      now + ALARM_MIN_TICK_MS,
    );

    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
    expect(
      alarmProvider.getScheduledWhen(TIMER_PROGRESS_ALARM),
    ).toBeUndefined();

    handle.dispose();
  });
});
