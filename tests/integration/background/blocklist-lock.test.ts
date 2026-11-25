import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('rejects a mutation received after a restored running session is reconciled', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    store.setState({
      timer: runningTimer(),
      blocklist: {
        blocklist: [{ domain: { value: 'facebook.com' }, manual: true, presetIds: [] }],
        appliedPresetIds: [],
        userPresets: [],
      },
    });

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
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { site: 'facebook.com' },
    });

    expect(store.getState().blocklist.blocklist).toHaveLength(1);
    expect(setSpy).not.toHaveBeenCalled();

    const rejection = records.find(
      (record) =>
        record.message === 'blocklist mutation ignored while the timer is not idle',
    );
    expect(rejection?.level).toBe('debug');
    expect(rejection?.scope).toBe('lock-test:mutation');
    expect(rejection?.details).toEqual([{ type: 'BLOCKLIST_REMOVE_SITE' }]);
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
    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } });
    await flushAsync();

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

    expect(popup.getState().blocklist.blocklist).toHaveLength(1);
    popup.getState().removeSite('facebook.com');
    expect(popup.getState().blocklist.blocklist).toHaveLength(0);
    await flushAsync();

    // The background rejected the removal; once the transition write reaches
    // the popup through the sync bridge, the optimistic removal is replaced by
    // the persisted blocklist, which still has the site.
    await vi.waitFor(() => {
      expect(popup.getState().timer.status).toBe('running');
    });

    expect(background.getState().blocklist.blocklist).toHaveLength(1);
    expect(popup.getState().blocklist.blocklist).toHaveLength(1);

    handle.dispose();
  });
});

/**
 * CR4.T4 — the CR2.T2 lock re-expressed for the preset messages: a restored
 * running session rejects every loosening preset mutation (CR5.T2: switching a
 * preset on is the add-direction exception), persists
 * nothing and logs only the message type.
 */
describe('preset mutations under the background lock (CR4.T4)', () => {
  const PRESET_MUTATIONS: ReadonlyArray<MutationMessage> = [
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

/**
 * CR5.T2 — the add-only window in the background: the single writer accepts a
 * message that only tightens the list while a session is running or paused,
 * judged by the message's own target (`applied`), and still drops the rest.
 */
describe('add-direction mutations in the background (CR5.T2)', () => {
  type Status = 'running' | 'paused' | 'completed';

  async function backgroundAt(status: Status) {
    const records: LogRecord[] = [];
    const logger = createLogger('add-test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store, logger });
    await handle.ready;
    store.setState({ timer: { ...store.getState().timer, status } });
    // Let the status write settle so a spy installed later only sees the
    // mutation under test.
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: { timer: { status: string } };
      };
      expect(parsed.state.timer.status).toBe(status);
    });
    await flushAsync();
    return { store, handle, records };
  }

  const domains = (store: ReturnType<typeof createAppStore>): string[] =>
    store.getState().blocklist.blocklist.map((entry) => entry.domain.value);

  /** Site counts of the blocklist in every snapshot written to storage. */
  const writtenSiteCounts = (setSpy: { mock: { calls: unknown[][] } }): number[] =>
    setSpy.mock.calls.map((call) => {
      const written = Object.values(call[0] as Record<string, string>)[0] ?? '{}';
      const parsed = JSON.parse(written) as {
        state: { blocklist: { blocklist: unknown[] } };
      };
      return parsed.state.blocklist.blocklist.length;
    });

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it.each(['running', 'paused'] as const)('persists an added site once while %s', async (status) => {
    const { store, handle } = await backgroundAt(status);
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } });
    await flushAsync();

    expect(domains(store)).toEqual(['facebook.com']);
    // Exactly one snapshot carries the new site: the mutation is persisted once.
    expect(writtenSiteCounts(setSpy).filter((count) => count === 1)).toHaveLength(1);

    setSpy.mockRestore();
    handle.dispose();
  });

  it.each(['running', 'paused'] as const)('applies a preset switched on while %s', async (status) => {
    const { store, handle } = await backgroundAt(status);

    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } });

    await flushAsync();

    expect(domains(store)).toHaveLength(4);
    expect(store.getState().blocklist.appliedPresetIds).toEqual(['social']);
    handle.dispose();
  });

  it('keeps a site added once a session ran out locked: completed accepts nothing', async () => {
    const { store, handle, records } = await backgroundAt('completed');
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } });
    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } });

    await flushAsync();

    expect(domains(store)).toEqual([]);
    expect(writtenSiteCounts(setSpy).every((count) => count === 0)).toBe(true);
    expect(
      records.filter((r) => r.message === 'blocklist mutation ignored while the timer is not idle'),
    ).toHaveLength(2);

    setSpy.mockRestore();
    handle.dispose();
  });

  it('judges a toggle by its target: switching a preset off is still dropped while running', async () => {
    const { store, handle, records } = await backgroundAt('running');
    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } });
    await flushAsync();
    const before = store.getState().blocklist;

    await sendMessage({ type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: false } });

    expect(store.getState().blocklist).toBe(before);
    expect(
      records.some((r) => r.message === 'blocklist mutation ignored while the timer is not idle'),
    ).toBe(true);
    handle.dispose();
  });

  it('does not let a forged toggle claim the add window with a non-boolean target', async () => {
    const { store, handle } = await backgroundAt('running');
    const before = store.getState().blocklist;

    await sendMessage({
      type: 'PRESET_TOGGLE',
      payload: { presetId: 'social', applied: 'true' },
    } as unknown as MutationMessage);

    expect(store.getState().blocklist).toBe(before);
    handle.dispose();
  });

  it('still drops a malformed add while running, logging only the type', async () => {
    const { store, handle, records } = await backgroundAt('running');

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 42 },
    } as unknown as MutationMessage);

    expect(domains(store)).toEqual([]);
    const dropped = records.find((r) => r.message === 'blocklist mutation dropped: malformed payload');
    expect(dropped?.details).toEqual([{ type: 'BLOCKLIST_ADD_SITE' }]);
    handle.dispose();
  });
});

/** The persisted timer status in each `storage.local.set` call, in order. */
const persistedStatuses = (
  setSpy: { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } },
): string[] =>
  setSpy.mock.calls.flatMap(([items]) => {
    const raw = (items as Record<string, unknown>)[STORE_NAME];
    if (typeof raw !== 'string') return [];
    const parsed = JSON.parse(raw) as { state: { timer: { status: string } } };
    return [parsed.state.timer.status];
  });

const domainNames = (
  entries: ReadonlyArray<{ domain: { value: string } }>,
): string[] => entries.map((entry) => entry.domain.value);

const quietLogger = (): ReturnType<typeof createLogger> =>
  createLogger('lock-test', { sink: () => undefined, minLevel: 'debug' });

interface PersistedSnapshot {
  state: {
    timer: { status: string };
    blocklist: { blocklist: ReadonlyArray<{ domain: { value: string } }> };
  };
}

const readPersisted = async (): Promise<PersistedSnapshot> => {
  const raw = await fakeBrowser.storage.local.get(STORE_NAME);
  return JSON.parse(raw[STORE_NAME] as string) as PersistedSnapshot;
};

// Persists a running session with the given sites, as a previous worker left it.
const seedRunningSession = async (sites: string[]): Promise<void> => {
  const previous = createAppStore();
  await previous.persist.rehydrate();
  previous.setState({
    timer: runningTimer(),
    blocklist: {
      blocklist: sites.map((site) => ({
        domain: { value: site },
        manual: true,
        presetIds: [],
      })),
      appliedPresetIds: [],
      userPresets: [],
    },
  });
  await vi.waitFor(async () => {
    expect((await readPersisted()).state.timer.status).toBe('running');
  });
};

// Holds every `storage.local.get` until `release()`. Each read is taken when it
// is issued (FIFO, like the real backend) and only its delivery waits, so a
// later write cannot leak into an earlier read.
const holdStorageReads = (): {
  readCount: () => number;
  release: () => void;
  restore: () => void;
} => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const local = fakeBrowser.storage.local;
  const realGet = local.get.bind(local) as (
    keys: string,
  ) => Promise<Record<string, unknown>>;
  const delayedGet = async (keys: string): Promise<Record<string, unknown>> => {
    const snapshot = realGet(keys);
    await gate;
    return snapshot;
  };
  const getSpy = vi
    .spyOn(local, 'get')
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    .mockImplementation(delayedGet as unknown as typeof local.get);
  return {
    readCount: () => getSpy.mock.calls.length,
    release: () => {
      release();
    },
    restore: () => {
      getSpy.mockRestore();
    },
  };
};

/**
 * PR5.T1 (red until fixed) — the startup window: the mutation listeners are
 * registered synchronously, while the persisted state is read asynchronously.
 * The storage read is held open here so a message provably arrives before the
 * background knows the session is running (see `docs/pr-review/pr-5-review.md`,
 * F1). Every idle-only mutation is a no-op on the empty default state, so the
 * window shows through CR5's add direction: an early add (legal while running)
 * lands on the defaults and persists them, and the remove that follows is
 * judged against the default `idle` instead of the persisted session.
 */
describe('blocklist lock before the startup hydration (PR5.T1)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('judges messages that arrive before the persisted running session is loaded against that session', async () => {
    // Persist a running session, as a previous worker would have left it.
    const previous = createAppStore();
    await previous.persist.rehydrate();
    previous.setState({
      timer: runningTimer(),
      blocklist: {
        blocklist: [{ domain: { value: 'facebook.com' }, manual: true, presetIds: [] }],
        appliedPresetIds: [],
        userPresets: [],
      },
    });
    await vi.waitFor(async () => {
      const raw = await fakeBrowser.storage.local.get(STORE_NAME);
      const parsed = JSON.parse(raw[STORE_NAME] as string) as {
        state: { timer: { status: string } };
      };
      expect(parsed.state.timer.status).toBe('running');
    });

    const alarmProvider = new FakeAlarmProvider(T0);
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1_500_000);

    // Hold every storage read until released: the worker has started, but the
    // persisted state is still "in flight". The read is taken when it is
    // issued (FIFO, like the real storage backend) and only its delivery is
    // delayed, so a later write cannot leak into an earlier read.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const local = fakeBrowser.storage.local;
    const realGet = local.get.bind(local) as (
      keys: string,
    ) => Promise<Record<string, unknown>>;
    const delayedGet = async (keys: string): Promise<Record<string, unknown>> => {
      const snapshot = realGet(keys);
      await gate;
      return snapshot;
    };
    const getSpy = vi
      .spyOn(local, 'get')
      // `storage.local.get` also has a callback overload typed as returning
      // void; the promise form is the one the storage adapter uses.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      .mockImplementation(delayedGet as unknown as typeof local.get);
    const setSpy = vi.spyOn(fakeBrowser.storage.local, 'set');

    const records: LogRecord[] = [];
    const logger = createLogger('lock-test', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    // A fresh store, as after a worker restart (no injected `store`).
    const handle = startBackground({ alarmProvider, now: () => T0, logger });

    // Allowed while running (CR5), then locked while running (CR2).
    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await sendMessage({ type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'x.com' } });
    await flushAsync();

    release();
    await handle.ready;
    await flushAsync();

    const domains = (entries: ReadonlyArray<{ domain: { value: string } }>): string[] =>
      entries.map((entry) => entry.domain.value);

    // Soft assertions so one run reports every symptom of the window.
    expect
      .soft(
        records.find(
          (record) =>
            record.message ===
            'blocklist mutation ignored while the timer is not idle',
        )?.details,
        'the early removal is rejected by the CR2 lock, logging only its type',
      )
      .toEqual([{ type: 'BLOCKLIST_REMOVE_SITE' }]);
    expect
      .soft(persistedStatuses(setSpy), 'storage never receives a default idle timer')
      .not.toContain('idle');
    expect
      .soft(handle.store.getState().timer.status, 'the session is still running')
      .toBe('running');
    expect
      .soft(
        domains(handle.store.getState().blocklist.blocklist),
        'the early add is kept on top of the persisted list',
      )
      .toEqual(['facebook.com', 'x.com']);

    getSpy.mockRestore();
    // What the next worker restart (or a popup) would read.
    const stored = await fakeBrowser.storage.local.get(STORE_NAME);
    const persisted = JSON.parse(stored[STORE_NAME] as string) as {
      state: {
        timer: { status: string };
        blocklist: { blocklist: ReadonlyArray<{ domain: { value: string } }> };
      };
    };
    expect
      .soft(persisted.state.timer.status, 'storage still holds the running session')
      .toBe('running');
    expect
      .soft(
        domains(persisted.state.blocklist.blocklist),
        'storage holds the persisted list plus the early add',
      )
      .toEqual(['facebook.com', 'x.com']);

    setSpy.mockRestore();
    handle.dispose();
  });

  it('credits the running stretch before an early add, and keeps the add', async () => {
    await seedRunningSession(['facebook.com']);
    const alarmProvider = new FakeAlarmProvider(T0);
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1_500_000);
    let clock = T0;
    const hold = holdStorageReads();
    const handle = startBackground({
      alarmProvider,
      now: () => clock,
      logger: quietLogger(),
    });
    clock = T0 + 120_000;

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await flushAsync();
    hold.release();
    await handle.ready;
    await flushAsync();

    expect
      .soft(
        domainNames(handle.store.getState().blocklist.blocklist),
        'the early add is kept on the hydrated list',
      )
      .toEqual(['facebook.com', 'x.com']);
    expect
      .soft(
        handle.store.getState().timer.focusedMs,
        'the stretch since the checkpoint is credited as focus',
      )
      .toBe(120_000);
    hold.restore();
    handle.dispose();
  });

  it('applies an early pause to the hydrated running session', async () => {
    await seedRunningSession([]);
    const alarmProvider = new FakeAlarmProvider(T0);
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1_500_000);
    let clock = T0;
    const hold = holdStorageReads();
    const handle = startBackground({
      alarmProvider,
      now: () => clock,
      logger: quietLogger(),
    });
    clock = T0 + 60_000;

    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
    await flushAsync();
    hold.release();
    await handle.ready;
    await flushAsync();

    expect
      .soft(handle.store.getState().timer.status, 'the pause is applied')
      .toBe('paused');
    expect
      .soft(
        handle.store.getState().timer.focusedMs,
        'the minute since the checkpoint is credited as focus',
      )
      .toBe(60_000);
    expect
      .soft((await readPersisted()).state.timer.status, 'storage holds the pause')
      .toBe('paused');
    hold.restore();
    handle.dispose();
  });

  it('applies an early add then remove to an idle list in arrival order', async () => {
    const hold = holdStorageReads();
    const handle = startBackground({
      alarmProvider: new FakeAlarmProvider(T0),
      now: () => T0,
      logger: quietLogger(),
    });

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'a.com' } });
    await sendMessage({ type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'a.com' } });
    await flushAsync();
    hold.release();
    await handle.ready;
    await flushAsync();

    expect(domainNames(handle.store.getState().blocklist.blocklist)).toEqual([]);
    expect((await readPersisted()).state.blocklist.blocklist).toEqual([]);
    hold.restore();
    handle.dispose();
  });

  it('applies an idle edit that arrives while a sync rehydration is in flight', async () => {
    const handle = startBackground({
      alarmProvider: new FakeAlarmProvider(T0),
      now: () => T0,
      logger: quietLogger(),
    });
    await handle.ready;

    // Another context (the popup) writes the store key; the background's own
    // sync read is the one held below.
    const hold = holdStorageReads();
    const readsBefore = hold.readCount();
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          blocklist: {
            blocklist: [{ domain: { value: 'other.com' }, manual: true, presetIds: [] }],
            appliedPresetIds: [],
            userPresets: [],
          },
        },
        version: 4,
      }),
    });
    await vi.waitFor(() => {
      expect(hold.readCount()).toBeGreaterThan(readsBefore);
    });

    // A hasHydrated() gate would hold this add: the sync rehydration resets it.
    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await flushAsync();
    expect(
      domainNames(handle.store.getState().blocklist.blocklist),
      'the idle edit is applied while the sync read is still pending',
    ).toContain('x.com');

    hold.release();
    await flushAsync();
    hold.restore();
    handle.dispose();
  });

  it('releases the waiting messages when the startup read fails', async () => {
    const local = fakeBrowser.storage.local;
    const rejectedRead = (): Promise<never> =>
      Promise.reject(new Error('storage unavailable'));
    vi.spyOn(local, 'get')
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      .mockImplementation(rejectedRead);
    const handle = startBackground({
      alarmProvider: new FakeAlarmProvider(T0),
      now: () => T0,
      logger: quietLogger(),
    });

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'x.com' } });
    await handle.ready;
    await flushAsync();

    expect(domainNames(handle.store.getState().blocklist.blocklist)).toEqual(['x.com']);
    handle.dispose();
  });
});
