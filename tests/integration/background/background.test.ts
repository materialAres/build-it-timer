import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import {
  bootstrapBackground,
  startBackground,
  MESSAGE_TYPES,
} from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import { MUTATION_TYPES } from '@/lib/messaging/messages.types';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createAppStore, DEFAULT_FOCUS_SECONDS, STORE_NAME } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { createLogger, type LogRecord } from '@/utils/logger';
import type { Tag } from '@/store/store.types';
import type { TabEventSource } from '@/lib/timer/tab-distraction-tracker';

describe('background orchestrator skeleton (M1.T7)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
  });

  it('starts without errors and exposes the wired store and alarm provider', () => {
    const handle = startBackground();

    expect(handle.store.getState().timer.status).toBe('idle');
    expect(typeof handle.alarmProvider.schedule).toBe('function');
    expect(typeof handle.alarmProvider.clear).toBe('function');
    expect(typeof handle.alarmProvider.onFire).toBe('function');

    handle.dispose();
  });

  it('logs a synchronous startup failure and returns null instead of throwing (M4.T3b)', () => {
    const store = createAppStore();
    vi.spyOn(store, 'getState').mockImplementation(() => {
      throw new Error('store unavailable');
    });
    const records: LogRecord[] = [];
    const logger = createLogger('background-test', {
      sink: (record) => {
        records.push(record);
      },
      minLevel: 'debug',
    });

    const handle = bootstrapBackground({ store, logger });

    expect(handle).toBeNull();
    const failure = records.find(
      (record) => record.message === 'background failed to start',
    );
    expect(failure).toBeDefined();
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('background-test');
    expect(failure?.details[0]).toBeInstanceOf(Error);
    expect(failure?.details[1]).toEqual({ boundary: 'bootstrap' });
  });

  it('logs a failed tab-tracker startup without crashing the worker (M4.T3b)', async () => {
    const records: LogRecord[] = [];
    const logger = createLogger('background-test', {
      sink: (record) => {
        records.push(record);
      },
      minLevel: 'debug',
    });
    const tabEventSource: TabEventSource = {
      queryTabs: () => Promise.reject(new Error('tabs unavailable')),
      onUpdated: () => () => undefined,
      onRemoved: () => () => undefined,
    };

    const handle = startBackground({
      alarmProvider: new FakeAlarmProvider(0),
      tabEventSource,
      logger,
    });
    await handle.ready;

    await vi.waitFor(() => {
      expect(
        records.some(
          (record) => record.message === 'tab distraction tracker failed to start',
        ),
      ).toBe(true);
    });
    expect(handle.store.getState().timer.status).toBe('idle');

    handle.dispose();
  });

  it('logs a failed startup reconciliation and keeps ready resolved (M4.T3b)', async () => {
    const store = createAppStore();
    vi.spyOn(store.persist, 'rehydrate').mockRejectedValue(
      new Error('hydration failed'),
    );
    const records: LogRecord[] = [];
    const logger = createLogger('background-test', {
      sink: (record) => {
        records.push(record);
      },
      minLevel: 'debug',
    });

    const handle = startBackground({ store, logger });
    await expect(handle.ready).resolves.toBeUndefined();

    const failure = records.find(
      (record) => record.message === 'startup reconciliation failed',
    );
    expect(failure).toBeDefined();
    expect(failure?.details[0]).toBeInstanceOf(Error);
    expect(failure?.details[1]).toEqual({ boundary: 'startup' });

    handle.dispose();
  });

  it('registers one message listener per RuntimeMessage type (spy)', () => {
    const addListener = vi.spyOn(browser.runtime.onMessage, 'addListener');

    const handle = startBackground();

    // Passive M1.T1 variants plus the M1.T10/M3.T3b mutation variants.
    expect(addListener).toHaveBeenCalledTimes(MESSAGE_TYPES.length + MUTATION_TYPES.length);
    expect(MESSAGE_TYPES).toHaveLength(4);

    handle.dispose();
    addListener.mockRestore();
  });

  it('registers an alarm listener on the injected provider', () => {
    const alarmProvider = new FakeAlarmProvider();
    const onFire = vi.spyOn(alarmProvider, 'onFire');

    const handle = startBackground({ alarmProvider });

    expect(onFire).toHaveBeenCalledTimes(1);

    handle.dispose();
  });

  it('accepts every message defined in M1.T1 without throwing', async () => {
    const handle = startBackground();

    const messages: RuntimeMessage[] = [
      { type: 'TIMER_TICK', payload: { remainingSeconds: 60 } },
      { type: 'TIMER_STARTED', payload: {} },
      { type: 'TIMER_PAUSED', payload: {} },
      { type: 'TIMER_RESET', payload: {} },
      {
        type: 'SITE_BLOCKED_ATTEMPT',
        payload: { domain: 'facebook.com', choice: 'proceed' },
      },
      { type: 'MALUS_APPLIED', payload: { domain: 'facebook.com', charactersRemoved: 1 } },
      {
        type: 'SESSION_ENDED',
        payload: { sessionId: 'session-1', score: 'good', population: 10, endedAt: 0 },
      },
    ];

    for (const message of messages) {
      await expect(sendMessage(message)).resolves.toEqual({ ok: true, value: undefined });
    }

    handle.dispose();
  });

  it('uses the injected store instead of creating a new one', () => {
    const store = createAppStore();

    const handle = startBackground({ store });

    expect(handle.store).toBe(store);

    handle.dispose();
  });

  it('detaches every listener on dispose', async () => {
    const handle = startBackground();
    handle.dispose();

    // No listeners left: the bus reports the expected "no listener" failure.
    const result = await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
    expect(result.ok).toBe(false);
  });

  it('syncs the background store on external writes (M1.T8 wired in)', async () => {
    const store = createAppStore();
    await store.persist.rehydrate();
    const handle = startBackground({ store });

    const tag: Tag = { id: 'focus', label: 'Focus' };
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: { blocklist: { ...store.getState().blocklist, customTags: [tag] } },
        version: 1,
      }),
    });

    expect(store.getState().blocklist.customTags).toEqual([tag]);

    handle.dispose();
  });
});

describe('background timer restore (M2.T2)', () => {
  const T0 = 1_700_000_000_000;
  const SESSION_ID = 'session-1';

  beforeEach(() => {
    fakeBrowser.reset();
  });

  /** Persist a `running` timer as a previous background instance would have. */
  async function persistRunningTimer(remainingSeconds: number): Promise<void> {
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          timer: {
            status: 'running',
            remainingSeconds,
            sessionStartedAt: T0,
            sessionId: SESSION_ID,
          },
        },
        version: 1,
      }),
    });
  }

  it('resumes the countdown from the pending alarm after a restart', async () => {
    await persistRunningTimer(DEFAULT_FOCUS_SECONDS);
    const alarmProvider = new FakeAlarmProvider(T0);
    // The alarm survived the restart; 5 minutes of wall-clock time elapsed.
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + DEFAULT_FOCUS_SECONDS * 1000);
    const now = T0 + 300 * 1000;

    const handle = startBackground({ alarmProvider, now: () => now });
    await handle.ready;

    const { timer } = handle.store.getState();
    expect(timer.status).toBe('running');
    expect(timer.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS - 300);
    expect(timer.sessionId).toBe(SESSION_ID);

    handle.dispose();
  });

  it('reverts a running timer to paused when no alarm is pending', async () => {
    await persistRunningTimer(DEFAULT_FOCUS_SECONDS);
    const alarmProvider = new FakeAlarmProvider(T0);

    const handle = startBackground({ alarmProvider, now: () => T0 });
    await handle.ready;

    const { timer } = handle.store.getState();
    expect(timer.status).toBe('paused');
    expect(timer.sessionId).toBe(SESSION_ID);

    handle.dispose();
  });

  it('leaves an idle timer untouched on startup', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);

    const handle = startBackground({ alarmProvider, now: () => T0 });
    await handle.ready;

    expect(handle.store.getState().timer.status).toBe('idle');

    handle.dispose();
  });
});
