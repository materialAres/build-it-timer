import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore } from '@/store';
import { createMalusWiring } from '@/entrypoints/background';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';

const T0 = 1_700_000_000_000;

const proceed = (domain: string) =>
  ({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain, choice: 'proceed' } }) as const;

/**
 * The malus is part of `builtCharacters` since CR6.T5b (option A): the wiring
 * only reports a drop that distraction time caused, once the user chose "Open
 * anyway". The tests drive the store the way the background's accounting step
 * does: the timer accumulators first, then the built count.
 */
describe('malus wiring (M2.T16, CR6.T5b)', () => {
  let alarmProvider: FakeAlarmProvider;

  beforeEach(() => {
    fakeBrowser.reset();
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function setup() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => T0, random: () => 0.5 },
    });
    const send = vi.fn<(message: RuntimeMessage) => void>();
    const wiring = createMalusWiring({ store, send });
    /** One accounting step: distraction time first, then the new built count. */
    const account = (distractedMs: number, built: number): void => {
      const { timer } = store.getState();
      store.getState().recordProgress(timer.focusedMs, distractedMs, T0);
      store.getState().setBuiltCharacters(built);
    };
    return { store, wiring, send, account };
  }

  async function startRunning(
    s: ReturnType<typeof setup>,
    built = 300,
  ): Promise<void> {
    await s.store.getState().startTimer();
    s.store.getState().setBuiltCharacters(built);
    s.send.mockClear();
  }

  it('removes nothing at "Open anyway": the score alone carries the malus', async () => {
    const s = setup();
    await startRunning(s);

    s.wiring.handleAttempt(proceed('facebook.com'));

    expect(s.store.getState().score.builtCharacters).toBe(300);
    expect(s.send).not.toHaveBeenCalled();
  });

  it('reports the characters lost when distraction time lowers the count', async () => {
    const s = setup();
    await startRunning(s);
    s.wiring.handleAttempt(proceed('facebook.com'));

    s.account(50_000, 256);

    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send).toHaveBeenCalledWith({
      type: 'MALUS_APPLIED',
      payload: { domain: 'facebook.com', charactersRemoved: 44 },
    });
  });

  it('reports each further drop, with the escalated amount', async () => {
    const s = setup();
    await startRunning(s);
    s.wiring.handleAttempt(proceed('facebook.com'));

    s.account(10_000, 296);
    s.account(50_000, 256);

    expect(s.send.mock.calls.map(([m]) => (m as { payload: { charactersRemoved: number } }).payload.charactersRemoved)).toEqual([4, 40]);
  });

  it('ignores the "go-back" choice', async () => {
    const s = setup();
    await startRunning(s);

    s.wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'go-back' } });
    s.account(50_000, 256);

    expect(s.send).not.toHaveBeenCalled();
  });

  it('does not double-report on two "proceed" events in close succession', async () => {
    const s = setup();
    await startRunning(s);

    s.wiring.handleAttempt(proceed('facebook.com'));
    s.wiring.handleAttempt(proceed('other.com'));
    s.account(50_000, 256);

    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send).toHaveBeenCalledWith({
      type: 'MALUS_APPLIED',
      payload: { domain: 'facebook.com', charactersRemoved: 44 },
    });
  });

  it('does not start when the timer is not running', () => {
    const s = setup();
    s.store.getState().setBuiltCharacters(300);

    s.wiring.handleAttempt(proceed('facebook.com'));
    s.account(50_000, 256);

    expect(s.send).not.toHaveBeenCalled();
  });

  it('does not report a drop that distraction did not cause (a reset)', async () => {
    const s = setup();
    await startRunning(s);
    s.wiring.handleAttempt(proceed('facebook.com'));

    s.store.getState().setBuiltCharacters(0);

    expect(s.send).not.toHaveBeenCalled();
  });

  it('does not report characters gained by focus', async () => {
    const s = setup();
    await startRunning(s, 100);
    s.wiring.handleAttempt(proceed('facebook.com'));

    s.account(0, 150);

    expect(s.send).not.toHaveBeenCalled();
  });

  it('forgets the choice when a new session starts', async () => {
    const s = setup();
    await startRunning(s);
    s.wiring.handleAttempt(proceed('facebook.com'));

    s.store.getState().resetCityForNewSession('session-2', 'default');
    s.account(50_000, 256);

    expect(s.send).not.toHaveBeenCalled();
  });

  it('stops reporting after dispose', async () => {
    const s = setup();
    await startRunning(s);
    s.wiring.handleAttempt(proceed('facebook.com'));
    s.wiring.dispose();

    s.account(50_000, 256);

    expect(s.send).not.toHaveBeenCalled();
  });
});
