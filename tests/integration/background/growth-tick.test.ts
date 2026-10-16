import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createAppStore, selectPopulation } from '@/store';
import {
  growCity,
  seedFromSession,
  GROWTH_TICK_MS,
} from '@/lib/city/growth-engine';
import { calculatePopulation } from '@/lib/score/calculate-population';
import type { CityLayers } from '@/components/city/city.types';

const T0 = 1_700_000_000_000;

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

    // First tick, 2s of focus after the session started.
    now = T0 + GROWTH_TICK_MS;
    await tick();
    let expected = growCity(empty, GROWTH_TICK_MS, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(1);

    // Second tick: another single character, never a block.
    now = T0 + GROWTH_TICK_MS * 2;
    await tick();
    expected = growCity(expected, GROWTH_TICK_MS, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(2);

    handle.dispose();
  });

  it('does not grow the city when a tick arrives while paused', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    now = T0 + GROWTH_TICK_MS;
    await tick();
    await store.getState().pauseTimer();
    const frozen = store.getState().city.layers;

    // Ticks keep arriving (a naive emitter) but the paused interval is not focus.
    now = T0 + GROWTH_TICK_MS * 10;
    await tick();

    expect(store.getState().city.layers).toBe(frozen);
    handle.dispose();
  });

  it('does not grow the city on a tick while idle', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    const before = store.getState().city.layers;
    now = T0 + GROWTH_TICK_MS * 3;
    await tick();

    expect(store.getState().city.layers).toBe(before);
    handle.dispose();
  });

  it('does not grow for a sub-tick delta (less than 2s of focus)', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    const empty = store.getState().city.layers;

    now = T0 + GROWTH_TICK_MS - 1;
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

    now = T0 + GROWTH_TICK_MS;
    await tick();
    await store.getState().pauseTimer();

    // Ten seconds pass paused, then the session resumes.
    now = T0 + GROWTH_TICK_MS * 5;
    await store.getState().startTimer();
    now = T0 + GROWTH_TICK_MS * 6;
    await tick();

    // Only the two 2s running stretches count, not the paused gap.
    const expected = growCity(growCity(empty, GROWTH_TICK_MS, seed), GROWTH_TICK_MS, seed);
    expect(store.getState().city.layers).toEqual(expected);
    expect(countOccupied(store.getState().city.layers)).toBe(2);
    handle.dispose();
  });
});

describe('population linked to the timer tick (M2.T18 live update)', () => {
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

  async function tick(remainingSeconds = 1_500): Promise<void> {
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds } });
  }

  /** Start a session and let `ms` of focus elapse through the 2s tick cadence. */
  async function runFocused(ms: number): Promise<number> {
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const ticks = Math.floor(ms / GROWTH_TICK_MS);
    for (let t = 1; t <= ticks; t += 1) {
      now = T0 + t * GROWTH_TICK_MS;
      await tick();
    }
    return ticks;
  }

  it('grows the population with the focused time while running', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    // 10 minutes of focus: one +5 batch per completed 2-second tick.
    const ticks = await runFocused(10 * 60_000);
    expect(selectPopulation(store.getState())).toBe(
      calculatePopulation(ticks * GROWTH_TICK_MS),
    );
    expect(selectPopulation(store.getState())).toBe(ticks * 5);

    handle.dispose();
  });

  it('adds 5 inhabitants every 2 seconds while running', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    expect(selectPopulation(store.getState())).toBe(0);

    now = T0 + GROWTH_TICK_MS;
    await tick();
    expect(selectPopulation(store.getState())).toBe(5);

    now = T0 + GROWTH_TICK_MS * 2;
    await tick();
    expect(selectPopulation(store.getState())).toBe(10);

    now = T0 + GROWTH_TICK_MS * 3;
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

    // A sub-tick delta completes no new 2-second tick, so the population is
    // unchanged and the slice must keep the same reference (no persist/re-render).
    now = T0 + 6 * 60_000 + GROWTH_TICK_MS - 1;
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

    now += GROWTH_TICK_MS;
    await tick();
    expect(selectPopulation(restartedStore.getState())).toBe(before + 5);

    restarted.dispose();
  });
});
