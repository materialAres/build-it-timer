import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage, onMessage } from '@/lib/messaging/bus';
import { createAppStore, selectVisibleFloors } from '@/store';
import {
  DEFAULT_FOCUS_PRESET,
  tickMsForDurationSeconds,
} from '@/lib/timer/focus-presets';
import { deliverAs, sendFromTab } from '@/tests/helpers/fake-extension-sender';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { FakeTabEventSource } from '@/tests/helpers/fake-tab-event-source';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';

const T0 = 1_700_000_000_000;
/** Cadence of the default preset used by the sessions here. */
const TICK_MS = tickMsForDurationSeconds(DEFAULT_FOCUS_PRESET.durationSeconds);

describe('malus linked to the score and the city (M2.T16, CR6.T5b)', () => {
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
    await sendFromTab(
      { type: 'SITE_BLOCKED_ATTEMPT', payload: { domain, choice: 'proceed' } },
      `https://${domain}/`,
    );
  }

  /** A focused stretch builds `built` characters, then a blocked tab is open. */
  async function focusThenOpenBlockedTab(built: number): Promise<ReturnType<typeof startWiredBackground>> {
    const wired = startWiredBackground();
    await wired.handle.ready;
    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } });
    await wired.store.getState().startTimer();
    now = T0 + built * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_000 } });
    expect(wired.store.getState().score.builtCharacters).toBe(built);
    tabEventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    return wired;
  }

  function collectMalus(): { received: RuntimeMessage[]; stop: () => void } {
    const received: RuntimeMessage[] = [];
    const stop = onMessage('MALUS_APPLIED', (message) => {
      received.push(message);
    });
    return { received, stop };
  }

  it('removes nothing at the "proceed" choice: the malus is part of the score (option A)', async () => {
    const { store, handle } = await focusThenOpenBlockedTab(100);
    const { received, stop } = collectMalus();

    await proceed();

    expect(store.getState().score.builtCharacters).toBe(100);
    expect(received).toEqual([]);
    stop();
    handle.dispose();
  });

  it('lowers the built characters by the escalated cost and reports the drop', async () => {
    const { store, handle } = await focusThenOpenBlockedTab(100);
    const { received, stop } = collectMalus();
    await proceed();

    // 20 session ticks on the blocked site: 5 + 12 + 27 = 44 characters, not 20.
    now += 20 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });

    expect(store.getState().score.builtCharacters).toBe(100 - 44);
    expect(received).toEqual([
      { type: 'MALUS_APPLIED', payload: { domain: 'facebook.com', charactersRemoved: 44 } },
    ]);
    stop();
    handle.dispose();
  });

  it('charges the same amount to the score and to the city floors', async () => {
    const { store, handle } = await focusThenOpenBlockedTab(100);
    await proceed();
    const before = selectVisibleFloors(store.getState());

    now += 20 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });

    const after = selectVisibleFloors(store.getState());
    expect(after.complete + after.partialFraction).toBeLessThan(before.complete + before.partialFraction);
    handle.dispose();
  });

  it('reports nothing on the "go-back" choice', async () => {
    const { store, handle } = await focusThenOpenBlockedTab(100);
    const { received, stop } = collectMalus();

    await sendMessage({
      type: 'SITE_BLOCKED_ATTEMPT',
      payload: { domain: 'facebook.com', choice: 'go-back' },
    });
    now += 20 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });

    // The time is still charged to the score, but nobody confirmed the visit.
    expect(store.getState().score.builtCharacters).toBe(100 - 44);
    expect(received).toEqual([]);
    stop();
    handle.dispose();
  });

  it('does not double-report two "proceed" events in close succession', async () => {
    const { handle } = await focusThenOpenBlockedTab(100);
    const { received, stop } = collectMalus();

    await proceed();
    await proceed();
    now += 20 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });

    expect(received).toHaveLength(1);
    stop();
    handle.dispose();
  });

  it('keeps charging while the blocked tab stays open, each step reported', async () => {
    const { store, handle } = await focusThenOpenBlockedTab(100);
    const { received, stop } = collectMalus();
    await proceed();

    now += 6 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });
    now += 6 * TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 800 } });

    // 6 ticks cost 5 + 2 = 7; 12 ticks cost 5 + 12 + 3 = 20 in all, so 13 more.
    expect(received.map((m) => (m as { payload: { charactersRemoved: number } }).payload.charactersRemoved)).toEqual([7, 13]);
    expect(store.getState().score.builtCharacters).toBe(100 - 20);
    stop();
    handle.dispose();
  });

  it('books a blocked tab that was already open when the session started as distraction', async () => {
    // The user opens a blocked site and *then* starts the timer: no
    // `tabs.onUpdated` event fires at start, so only a re-read of the open tabs
    // can register the tab with the distraction tracker.
    tabEventSource.setInitialTabs([{ id: 1, url: 'https://facebook.com/' }]);
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } });
    await store.getState().startTimer();

    now = T0 + TICK_MS;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_400 } });

    expect(store.getState().timer.distractedMs).toBe(TICK_MS);
    expect(store.getState().timer.focusedMs).toBe(0);
    handle.dispose();
  });

  it('counts time on a site as distraction only from the moment it was added (CR5.T2)', async () => {
    // The tab is already open when the session starts, but the site is not
    // blocked yet, so that time is focus.
    tabEventSource.setInitialTabs([{ id: 1, url: 'https://facebook.com/' }]);
    const { store, handle } = startWiredBackground();
    await handle.ready;
    await store.getState().startTimer();

    now = T0 + 30_000;
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'facebook.com' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    now = T0 + 40_000;
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1_460 } });

    // 30s before the add stay focus; only the 10s after it are distraction,
    // with no retroactive malus for the time before.
    expect(store.getState().timer.focusedMs).toBe(30_000);
    expect(store.getState().timer.distractedMs).toBe(10_000);
    handle.dispose();
  });

  describe('the answer is bound to the sending tab (M6.T1)', () => {
    const forged = (domain: string) => ({
      type: 'SITE_BLOCKED_ATTEMPT',
      payload: { domain, choice: 'proceed', tabId: 99 },
    });

    async function chargeAndCollect(
      send: () => Promise<void>,
    ): Promise<RuntimeMessage[]> {
      const { handle } = await focusThenOpenBlockedTab(100);
      const { received, stop } = collectMalus();
      await send();
      now += 20 * TICK_MS;
      await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 900 } });
      stop();
      handle.dispose();
      return received;
    }

    it('reports the domain of the sender tab, not the one written in the payload', async () => {
      const received = await chargeAndCollect(() =>
        sendFromTab(forged('evil.com'), 'https://m.facebook.com/feed'),
      );

      expect(received).toEqual([
        { type: 'MALUS_APPLIED', payload: { domain: 'facebook.com', charactersRemoved: 44 } },
      ]);
    });

    it('ignores an answer that does not come from a tab', async () => {
      const received = await chargeAndCollect(async () => {
        await sendMessage(forged('facebook.com') as unknown as RuntimeMessage);
      });

      expect(received).toEqual([]);
    });

    it('ignores an answer whose tab is not a web page', async () => {
      const received = await chargeAndCollect(() =>
        sendFromTab(forged('facebook.com'), 'chrome://newtab/'),
      );

      expect(received).toEqual([]);
    });

    it('ignores an answer from a foreign extension even with a tab', async () => {
      const received = await chargeAndCollect(async () => {
        await deliverAs(forged('facebook.com'), {
          id: 'someone-else',
          tab: { id: 1, url: 'https://facebook.com/' },
        });
      });

      expect(received).toEqual([]);
    });
  });
});

