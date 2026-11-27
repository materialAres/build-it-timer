import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { onMessage, sendMessage } from '@/lib/messaging/bus';
import { createAppStore } from '@/store';
import { deliverAs as deliver } from '@/tests/helpers/fake-extension-sender';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { createLogger, type LogRecord } from '@/utils/logger';

const T0 = 1_700_000_000_000;

const FOREIGN = { id: 'some-other-extension' };

describe('message bus hardening (M6.T1)', () => {
  let records: LogRecord[];

  beforeEach(() => {
    fakeBrowser.reset();
    records = [];
  });

  async function startWired() {
    const alarmProvider = new FakeAlarmProvider(T0);
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => T0, random: () => 0.5 },
    });
    const logger = createLogger('hardening', {
      sink: (record) => records.push(record),
      minLevel: 'debug',
    });
    const handle = startBackground({ store, alarmProvider, now: () => T0, logger });
    await handle.ready;
    return { store, handle };
  }

  describe('sender provenance', () => {
    it.each([
      ['a foreign extension id', FOREIGN],
      ['no sender at all', undefined],
      ['a sender with no id', {}],
      ['a web page spoofing the shape', { url: 'https://evil.com', tab: { id: 3 } }],
    ])('rejects a timer command from %s', async (_label, sender) => {
      const { store, handle } = await startWired();

      await deliver({ type: 'TIMER_STARTED', payload: {} }, sender);

      expect(store.getState().timer.status).toBe('idle');
      handle.dispose();
    });

    it('rejects a blocklist mutation from a foreign sender and leaves the store untouched', async () => {
      const { store, handle } = await startWired();
      const before = store.getState().blocklist;

      await deliver({ type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } }, FOREIGN);

      expect(store.getState().blocklist).toBe(before);
      expect(records.some((r) => r.message === 'ignored a message from a foreign sender')).toBe(true);
      handle.dispose();
    });

    it('rejects a foreign sender for every receiver, not only the background', async () => {
      const handler = vi.fn();
      const stop = onMessage('PLAY_SOUND', handler);

      await deliver(
        { type: 'PLAY_SOUND', payload: { themeId: 'glitch', cue: 'start', volume: 50 } },
        FOREIGN,
      );

      expect(handler).not.toHaveBeenCalled();
      stop();
    });

    it('accepts the same message from the extension itself', async () => {
      const { store, handle } = await startWired();

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(store.getState().timer.status).toBe('running');
      handle.dispose();
    });
  });

  describe('runtime validation', () => {
    it.each([
      { type: 'NOPE', payload: {} },
      { type: 'TIMER_STARTED' },
      { type: 'TIMER_STARTED', payload: null },
      { type: 'TIMER_STARTED', payload: { sessionId: 'forged' } },
      { type: 'TIMER_SET_DURATION', payload: { durationSeconds: '1500' } },
      { type: 'TIMER_TICK', payload: { remainingSeconds: 'soon' } },
      { type: 'BLOCKLIST_ADD_SITE', payload: { site: { toString: 'x' } } },
      { type: 'PREFERENCES_SOUND_SET', payload: { volume: 1000 } },
      'TIMER_STARTED',
      42,
      null,
    ])('ignores the forged message %j: no crash, no mutation', async (forged) => {
      const { store, handle } = await startWired();
      const before = store.getState();

      await expect(
        deliver(forged, { id: fakeBrowser.runtime.id }),
      ).resolves.toBeUndefined();

      expect(store.getState().timer).toBe(before.timer);
      expect(store.getState().blocklist).toBe(before.blocklist);
      expect(store.getState().preferences).toBe(before.preferences);
      handle.dispose();
    });

    it('ignores a tabId injected in a payload: handlers never see it', async () => {
      const seen: unknown[] = [];
      const stop = onMessage('SITE_BLOCKED_ATTEMPT', (message) => {
        seen.push(message);
      });

      await deliver(
        {
          type: 'SITE_BLOCKED_ATTEMPT',
          tabId: 99,
          payload: { domain: 'facebook.com', choice: 'proceed', tabId: 99 },
        },
        { id: fakeBrowser.runtime.id },
      );

      expect(seen).toEqual([
        { type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } },
      ]);
      stop();
    });

    it('hands every handler a fresh object, never the one that crossed the wire', async () => {
      const wire = { type: 'TIMER_TICK', payload: { remainingSeconds: 5 } };
      let received: unknown;
      const stop = onMessage('TIMER_TICK', (message) => {
        received = message;
      });

      await deliver(wire, { id: fakeBrowser.runtime.id });

      expect(received).toEqual(wire);
      expect(received).not.toBe(wire);
      stop();
    });

    it('logs the type only for a malformed message, never a payload field', async () => {
      const { handle } = await startWired();

      await deliver(
        { type: 'BLOCKLIST_ADD_SITE', payload: { site: 42, secret: 'top-secret' } },
        { id: fakeBrowser.runtime.id },
      );

      expect(JSON.stringify(records)).not.toContain('top-secret');
      const logged = records.find((r) => r.message === 'ignored a malformed message');
      expect(logged?.details).toEqual([{ type: 'BLOCKLIST_ADD_SITE' }]);
      handle.dispose();
    });
  });
});
