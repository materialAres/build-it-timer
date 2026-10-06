import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage, onMessage } from '@/lib/messaging/bus';
import { createAppStore } from '@/store';
import { applyMalus } from '@/lib/score/apply-malus';
import { growCity, seedFromSession, GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { FakeTabEventSource } from '@/tests/helpers/fake-tab-event-source';
import type { CityLayers } from '@/components/city/city.types';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';

const T0 = 1_700_000_000_000;

function countOccupied(layers: CityLayers): number {
  return [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );
}

describe('malus linked to building destruction (M2.T16)', () => {
  let now: number;
  let alarmProvider: FakeAlarmProvider;
  let tabEventSource: FakeTabEventSource;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
    tabEventSource = new FakeTabEventSource();
  });

  function startWiredBackground() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now, tabEventSource });
    return { store, handle };
  }

  async function proceed(domain = 'facebook.com'): Promise<void> {
    await sendMessage({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain, choice: 'proceed' } });
  }

  it('destroys a character in the same update cycle as the "proceed" choice', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    store.getState().growCity(GROWTH_TICK_MS * 3);
    const before = store.getState().city.layers;
    expect(countOccupied(before)).toBe(3);

    await proceed();

    expect(store.getState().city.layers).toEqual(applyMalus(before, 1));
    expect(countOccupied(store.getState().city.layers)).toBe(2);
    handle.dispose();
  });

  it('emits MALUS_APPLIED with the domain and the removed character count', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    const received: RuntimeMessage[] = [];
    const unsubscribe = onMessage('MALUS_APPLIED', (message) => {
      received.push(message);
    });

    await store.getState().startTimer();
    store.getState().growCity(GROWTH_TICK_MS * 2);
    await proceed();

    expect(received).toEqual([
      { type: 'MALUS_APPLIED', payload: { domain: 'facebook.com', charactersRemoved: 1 } },
    ]);
    unsubscribe();
    handle.dispose();
  });

  it('does not destroy anything on the "go-back" choice', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;
    const received: RuntimeMessage[] = [];
    const unsubscribe = onMessage('MALUS_APPLIED', (message) => {
      received.push(message);
    });

    await store.getState().startTimer();
    store.getState().growCity(GROWTH_TICK_MS * 2);
    const before = store.getState().city.layers;

    await sendMessage({
      type: 'SITE_BLOCKED_ATTEMPT',
      payload: { domain: 'facebook.com', choice: 'go-back' },
    });

    expect(store.getState().city.layers).toBe(before);
    expect(received).toEqual([]);
    unsubscribe();
    handle.dispose();
  });

  it('does not double-apply two malus events in close succession', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    store.getState().growCity(GROWTH_TICK_MS * 3);
    await proceed();
    await proceed();

    expect(countOccupied(store.getState().city.layers)).toBe(2);
    handle.dispose();
  });

  it('keeps destroying one character per 2s while a blocked tab stays open', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await store.getState().startTimer();
    store.getState().growCity(GROWTH_TICK_MS * 4);
    const seed = seedFromSession(store.getState().city.sessionId);

    await proceed();
    const afterProceed = store.getState().city.layers;
    expect(countOccupied(afterProceed)).toBe(3);

    // The blocked tab is open (facebook.com is on the blocklist); 2s later a
    // timer tick grows the city by one character and the malus removes one, one
    // after the other.
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'facebook.com' },
    });
    tabEventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    now = T0 + GROWTH_TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_400 } });

    const expected = applyMalus(growCity(afterProceed, GROWTH_TICK_MS, seed), 1);
    expect(store.getState().city.layers).toEqual(expected);
    handle.dispose();
  });
});
