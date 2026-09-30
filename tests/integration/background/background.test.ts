import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { startBackground, MESSAGE_TYPES } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createAppStore } from '@/store';

describe('background orchestrator skeleton (M1.T7)', () => {
  beforeEach(() => {
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

  it('registers one message listener per RuntimeMessage type (spy)', () => {
    const addListener = vi.spyOn(browser.runtime.onMessage, 'addListener');

    const handle = startBackground();

    expect(addListener).toHaveBeenCalledTimes(MESSAGE_TYPES.length);
    expect(MESSAGE_TYPES).toHaveLength(6);

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
      { type: 'TIMER_STARTED', payload: { sessionId: 'session-1' } },
      { type: 'TIMER_PAUSED', payload: {} },
      {
        type: 'SITE_BLOCKED_ATTEMPT',
        payload: { domain: 'facebook.com', choice: 'proceed', tabId: 1 },
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
});
