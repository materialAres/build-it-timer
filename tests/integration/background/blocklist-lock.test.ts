import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { attachStoreSync, createAppStore, STORE_NAME } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createLogger, type LogRecord } from '@/utils/logger';
import type { TimerState } from '@/store/store.types';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import { installFakeDynamicRules } from '@/tests/helpers/fake-declarative-net-request';

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

/**
 * CR4.T4 — the CR2.T2 lock re-expressed for the preset messages: a restored
 * running session rejects every preset mutation in the background, persists
 * nothing and logs only the message type.
 */
describe('preset mutations under the background lock (CR4.T4)', () => {
  const PRESET_MUTATIONS: ReadonlyArray<MutationMessage> = [
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'user:secret', applied: false } },
    { type: 'PRESET_SAVE', payload: { id: 'user:new', name: 'Secret name' } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:secret', name: 'Renamed' } },
    { type: 'PRESET_DELETE', payload: { presetId: 'user:secret' } },
  ];

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it.each(PRESET_MUTATIONS)('rejects %j while running and logs only the type', async (mutation) => {
    const records: LogRecord[] = [];
    const logger = createLogger('lock-test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const store = createAppStore();
    await store.persist.rehydrate();
    store.setState({
      blocklist: {
        blocklist: [{ domain: { value: 'x.com' }, manual: false, presetIds: ['user:secret'] }],
        appliedPresetIds: ['user:secret'],
        userPresets: [{ id: 'user:secret', name: 'Secret', domains: [{ value: 'x.com' }] }],
      },
    });
    const handle = startBackground({ store, logger });
    await handle.ready;
    store.setState({ timer: { ...store.getState().timer, status: 'running' } });

    const before = store.getState().blocklist;
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');
    await sendMessage(mutation);

    expect(store.getState().blocklist).toBe(before);
    expect(setSpy).not.toHaveBeenCalled();
    const rejection = records.find(
      (record) => record.message === 'blocklist mutation ignored while the timer is not idle',
    );
    expect(rejection?.details).toEqual([{ type: mutation.type }]);
    expect(JSON.stringify(records)).not.toContain('Secret');

    setSpy.mockRestore();
    handle.dispose();
  });

  it('DNR rules follow a preset toggled while idle once the session runs', async () => {
    const dnr = installFakeDynamicRules();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(T0) });
    await handle.ready;

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'video', applied: true } });
    await handle.store.getState().startTimer();
    await flushAsync();

    const filters = dnr.liveRules().map((rule) => rule.condition.urlFilter).sort();
    expect(filters).toEqual(
      ['||netflix.com^', '||twitch.tv^', '||vimeo.com^', '||x.com^', '||youtube.com^'],
    );

    // Back to idle, switch the preset off: the next session blocks only x.com.
    await handle.store.getState().resetTimer();
    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'video', applied: false } });
    await handle.store.getState().startTimer();
    await flushAsync();

    expect(dnr.liveRules().map((rule) => rule.condition.urlFilter)).toEqual(['||x.com^']);

    handle.dispose();
  });
});
