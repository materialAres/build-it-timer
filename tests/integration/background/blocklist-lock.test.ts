import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { attachStoreSync, createAppStore, STORE_NAME } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createLogger, type LogRecord } from '@/utils/logger';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;
const SESSION_ID = 'session-1';

/** Let the storage event → rehydrate chain (async) settle before asserting. */
const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const runningTimer = (): TimerState => ({
  status: 'running',
  durationSeconds: 1500,
  remainingSeconds: 1500,
  sessionStartedAt: T0,
  sessionId: SESSION_ID,
  endsAt: T0 + 1_500_000,
  focusedMs: 0,
  distractedMs: 0,
  lastAccountedAt: T0,
});

/**
 * CR2.T2 — the lock must hold in the background too, because it is the single
 * writer: a message that bypasses the store/UI guard (stale tab, forged sender)
 * must not change or persist anything.
 */
describe('blocklist lock in the background (CR2.T2)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('rejects a mutation received while a restored running session is reconciled', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    store.setState({ timer: runningTimer() });

    // Wait for the running state to be the persisted one, then rehydrate again
    // to simulate a worker restart reading that payload.
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: { timer: { status: string } };
      };
      expect(parsed.state.timer.status).toBe('running');
    });
    await store.persist.rehydrate();

    // The pending alarm is what lets the restore keep the session running.
    const alarmProvider = new FakeAlarmProvider(T0);
    await alarmProvider.schedule(
      timerAlarmName(SESSION_ID),
      T0 + 1_500_000,
    );

    const records: LogRecord[] = [];
    const logger = createLogger('lock-test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const handle = startBackground({
      store,
      alarmProvider,
      now: () => T0,
      logger,
    });
    await handle.ready;
    expect(store.getState().timer.status).toBe('running');

    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'facebook.com' },
    });

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(setSpy).not.toHaveBeenCalled();

    const rejection = records.find(
      (record) =>
        record.message === 'blocklist mutation ignored while the timer is not idle',
    );
    expect(rejection?.level).toBe('debug');
    expect(rejection?.scope).toBe('lock-test:mutation');
    expect(rejection?.details).toEqual([{ type: 'BLOCKLIST_ADD_SITE' }]);
    // The diagnostic must not leak the payload or a domain.
    expect(JSON.stringify(records)).not.toContain('facebook.com');

    setSpy.mockRestore();
    handle.dispose();
  });

  it('converges a popup that acted on a stale idle status when the running transition arrives', async () => {
    const background = createAppStore();
    await background.persist.rehydrate();
    const handle = startBackground({ store: background });
    await handle.ready;

    // A popup-like context that hydrated before the session started.
    const popup = createAppStore({ readOnly: true });
    await popup.persist.rehydrate();
    attachStoreSync(popup);
    expect(popup.getState().timer.status).toBe('idle');

    // The session starts; the popup has not processed the storage event yet, so
    // its own guard still sees `idle` and applies the edit optimistically.
    background.setState({
      timer: { ...background.getState().timer, status: 'running' },
    });
    expect(popup.getState().timer.status).toBe('idle');

    popup.getState().addSite('facebook.com');
    expect(popup.getState().blocklist.blocklist).toHaveLength(1);
    await flushAsync();

    // The background rejected it; once the transition write reaches the popup
    // through the sync bridge, the optimistic entry is replaced by the
    // persisted (empty) blocklist.
    await vi.waitFor(() => {
      expect(popup.getState().timer.status).toBe('running');
    });

    expect(background.getState().blocklist.blocklist).toEqual([]);
    expect(popup.getState().blocklist.blocklist).toEqual([]);

    handle.dispose();
  });
});
