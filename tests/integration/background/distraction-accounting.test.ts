import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { FakeTabEventSource } from '@/tests/helpers/fake-tab-event-source';
import { createAppStore } from '@/store';
import { ALARM_MIN_TICK_MS } from '@/lib/timer/alarm-adapter';
import { TIMER_PROGRESS_ALARM } from '@/lib/timer/session';

/**
 * I014: with the popup closed only the 60 s heartbeat accounts. Time must still
 * be booked to the tab state it was really spent in, not to the state at the
 * instant the heartbeat fires (measured in the built extension: 20 s on a
 * blocked site were charged 0 ms, 15 s were charged 59 s).
 */
describe('distraction is booked when it happens, not when the heartbeat fires (I014)', () => {
  const T0 = 1_700_000_000_000;
  let now: number;
  let alarmProvider: FakeAlarmProvider;
  let tabs: FakeTabEventSource;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
    tabs = new FakeTabEventSource();
  });

  async function startWithPopupClosed() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now, tabEventSource: tabs });
    await handle.ready;
    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    return { store, handle };
  }

  const heartbeat = (): void => {
    now = T0 + ALARM_MIN_TICK_MS;
    expect(alarmProvider.advanceBy(ALARM_MIN_TICK_MS)).toContain(TIMER_PROGRESS_ALARM);
  };

  it('a blocked visit that ends before the heartbeat is still charged', async () => {
    const { store, handle } = await startWithPopupClosed();

    now = T0 + 5_000;
    tabs.emitUpdated({ id: 1, url: 'https://x.com/feed' });
    now = T0 + 25_000;
    tabs.emitRemoved(1);
    heartbeat();

    expect(store.getState().timer.distractedMs).toBe(20_000);
    expect(store.getState().timer.focusedMs).toBe(40_000);
    handle.dispose();
  });

  it('focus before a blocked visit that is still open at the heartbeat stays focus', async () => {
    const { store, handle } = await startWithPopupClosed();

    now = T0 + 45_000;
    tabs.emitUpdated({ id: 1, url: 'https://x.com/feed' });
    heartbeat();

    expect(store.getState().timer.focusedMs).toBe(45_000);
    expect(store.getState().timer.distractedMs).toBe(15_000);
    handle.dispose();
  });
});
