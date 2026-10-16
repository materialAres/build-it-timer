import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createAppStore, attachStoreSync, STORE_NAME, selectPopulation } from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
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
 * M3.T3b — popup → background timer path. The popup's store is read-only
 * (M1.T9), so its timer commands travel as mutations (M1.T10) and are applied to
 * the background's own timer slice, which owns the alarm provider. The popup
 * then converges through the M1.T8 sync bridge.
 */
describe('popup → background timer path (M3.T3b)', () => {
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

  it('applies TIMER_STARTED to the background store and schedules the alarm there', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });

    const { timer } = store.getState();
    expect(timer.status).toBe('running');
    expect(timer.sessionId).not.toBeNull();
    // The alarm lives on the *background's* provider, not on the popup's copy.
    expect(alarmProvider.scheduledAlarms).toHaveLength(1);
    expect(alarmProvider.getScheduledWhen(timerAlarmName(timer.sessionId ?? ''))).toBeDefined();

    handle.dispose();
  });

  it('applies TIMER_PAUSED and clears the pending alarm', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const sessionId = store.getState().timer.sessionId ?? '';
    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });

    expect(store.getState().timer.status).toBe('paused');
    expect(alarmProvider.getScheduledWhen(timerAlarmName(sessionId))).toBeUndefined();

    handle.dispose();
  });

  it('applies TIMER_RESET and returns the timer to idle', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    await sendMessage({ type: 'TIMER_RESET', payload: {} });

    const { timer } = store.getState();
    expect(timer.status).toBe('idle');
    expect(timer.sessionId).toBeNull();
    expect(alarmProvider.scheduledAlarms).toHaveLength(0);

    handle.dispose();
  });

  it('applies a timer command exactly once and persists the result', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const firstSessionId = store.getState().timer.sessionId;

    // A duplicate command must not open a second session (the slice is
    // idempotent while running, M2.T1): the mutation is applied once.
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    expect(store.getState().timer.sessionId).toBe(firstSessionId);

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { timer: { status: string; sessionId: string } };
    };
    expect(parsed.state.timer.status).toBe('running');
    expect(parsed.state.timer.sessionId).toBe(firstSessionId);

    handle.dispose();
  });

  it('ignores a timer command with a non-empty payload without mutating', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage({
      type: 'TIMER_STARTED',
      payload: { sessionId: 'forged' },
    } as unknown as Parameters<typeof sendMessage>[0]);

    expect(store.getState().timer.status).toBe('idle');
    expect(setSpy).not.toHaveBeenCalled();

    setSpy.mockRestore();
    handle.dispose();
  });

  it('converges a read-only popup store on a timer command (M1.T8)', async () => {
    const backgroundStore = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    await backgroundStore.persist.rehydrate();
    const handle = startBackground({ store: backgroundStore, alarmProvider, now: () => now });

    // A popup-like context: read-only store + sync attached, as in main.tsx.
    const popupStore = createAppStore({ readOnly: true });
    await popupStore.persist.rehydrate();
    attachStoreSync(popupStore);

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    await flushAsync();

    expect(popupStore.getState().timer.status).toBe('running');
    expect(popupStore.getState().timer.sessionId).toBe(
      backgroundStore.getState().timer.sessionId,
    );

    handle.dispose();
  });

  it('propagates the live population to a read-only popup store (M2.T18)', async () => {
    const backgroundStore = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    await backgroundStore.persist.rehydrate();
    const handle = startBackground({ store: backgroundStore, alarmProvider, now: () => now });

    const popupStore = createAppStore({ readOnly: true });
    await popupStore.persist.rehydrate();
    attachStoreSync(popupStore);

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    await flushAsync();

    // Two ticks of focus: the popup must see +5 each time through the sync
    // bridge, not only at session completion.
    now = T0 + GROWTH_TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_500 } });
    await flushAsync();
    expect(selectPopulation(popupStore.getState())).toBe(5);

    now = T0 + GROWTH_TICK_MS * 2;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_498 } });
    await flushAsync();
    expect(selectPopulation(popupStore.getState())).toBe(10);

    handle.dispose();
  });

  it('grows the city on a command + simulated tick sequence', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const empty = store.getState().city.layers;

    now = T0 + GROWTH_TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_500 } });
    expect(countOccupied(store.getState().city.layers)).toBe(1);

    now = T0 + GROWTH_TICK_MS * 2;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_498 } });
    expect(countOccupied(store.getState().city.layers)).toBe(2);
    expect(store.getState().city.layers).not.toBe(empty);

    handle.dispose();
  });

  it('does not grow the city when a tick follows a pause command', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    now = T0 + GROWTH_TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_500 } });
    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
    const frozen = store.getState().city.layers;

    now = T0 + GROWTH_TICK_MS * 10;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_480 } });

    expect(store.getState().city.layers).toBe(frozen);
    handle.dispose();
  });
});
