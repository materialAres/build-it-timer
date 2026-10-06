import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createAppStore } from '@/store';
import {
  growCity,
  seedFromSession,
  GROWTH_TICK_MS,
} from '@/lib/city/growth-engine';
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
