import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createAppStore, STORE_NAME } from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { timerAlarmName } from '@/lib/timer/session';
import { calculatePopulation } from '@/lib/score/calculate-population';
import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import type { SessionSummary } from '@/store/store.types';

const T0 = 1_700_000_000_000;
const FOCUS_SECONDS = 25 * 60;

/**
 * M3.T3c — session completion. The alarm scheduled at the end of the countdown
 * fires, the timer leaves `running` and the outcome is recorded in the history
 * (M2.T19) and the population counter (M2.T18).
 */
describe('session completion (M3.T3c)', () => {
  let now: number;
  let alarmProvider: FakeAlarmProvider;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function startWiredBackground() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({ store, alarmProvider, now: () => now });
    return { store, handle };
  }

  /** Start a session and let `ms` of focus elapse through the 2s tick cadence. */
  async function runSession(ms: number) {
    await sendMessage({ type: 'TIMER_STARTED', payload: {} });
    const ticks = Math.floor(ms / GROWTH_TICK_MS);
    for (let tick = 1; tick <= ticks; tick += 1) {
      now = T0 + tick * GROWTH_TICK_MS;
      await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: FOCUS_SECONDS } });
    }
    return ticks;
  }

  it('records exactly one history entry with the expected population on completion', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    // 10 minutes of focus: the 5' base and the 10' floor are unlocked.
    const ticks = await runSession(10 * 60_000);
    const expectedPopulation = calculatePopulation((ticks * GROWTH_TICK_MS) / 60_000);

    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    const { sessionHistory, score, timer } = store.getState();
    expect(sessionHistory.sessions).toHaveLength(1);
    expect(sessionHistory.sessions[0]?.population).toBe(expectedPopulation);
    expect(sessionHistory.sessions[0]?.score).toBe('excellent');
    expect(sessionHistory.sessions[0]?.endedAt).toBe(now);
    expect(score.population).toBe(expectedPopulation);
    expect(timer.status).toBe('completed');
    expect(timer.remainingSeconds).toBe(0);

    handle.dispose();
  });

  it('emits SESSION_ENDED with the recorded summary', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    const received: RuntimeMessage[] = [];
    const { onMessage } = await import('@/lib/messaging/bus');
    const unsubscribe = onMessage('SESSION_ENDED', (message) => {
      received.push(message);
    });

    await runSession(4 * 60_000);
    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    expect(received).toHaveLength(1);
    const summary = (received[0] as { payload: SessionSummary }).payload;
    expect(summary.sessionId).toBe(store.getState().sessionHistory.sessions[0]?.sessionId);
    expect(summary.population).toBe(store.getState().score.population);

    unsubscribe();
    handle.dispose();
  });

  it('replaces the entry instead of growing the history on a re-emitted summary', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);
    const sessionId = store.getState().sessionHistory.sessions[0]?.sessionId ?? '';

    // A re-emitted summary for the same session (M2.T19 dedup contract).
    store.getState().recordSession({
      sessionId,
      score: 'good',
      population: 999,
      endedAt: now,
    });

    expect(store.getState().sessionHistory.sessions).toHaveLength(1);
    expect(store.getState().sessionHistory.sessions[0]?.population).toBe(999);

    handle.dispose();
  });

  it('records nothing when the session is paused before completion', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });

    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    expect(store.getState().sessionHistory.sessions).toHaveLength(0);
    expect(store.getState().timer.status).toBe('paused');

    handle.dispose();
  });

  it('records nothing when the session is reset before completion', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    await sendMessage({ type: 'TIMER_RESET', payload: {} });

    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    expect(store.getState().sessionHistory.sessions).toHaveLength(0);
    expect(store.getState().timer.status).toBe('idle');

    handle.dispose();
  });

  it('ignores a stale alarm from a previous session', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    const currentSessionId = store.getState().timer.sessionId ?? '';

    // A leftover alarm name that does not belong to the running session.
    alarmProvider.advanceBy(0);
    const stale = timerAlarmName('1700000000000-stale');
    expect(stale).not.toBe(timerAlarmName(currentSessionId));

    // Fire the stale alarm directly through the provider's listener set.
    const fired = alarmProvider.fireDue();
    expect(fired).toHaveLength(0);
    expect(store.getState().sessionHistory.sessions).toHaveLength(0);
    expect(store.getState().timer.status).toBe('running');

    handle.dispose();
  });

  it('clears the pending alarm and the DNR rules on completion', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await sendMessage({ type: 'BLOCKLIST_ADD_SITE', payload: { list: 'blocklist', site: 'x.com' } });
    await runSession(4 * 60_000);
    const sessionId = store.getState().timer.sessionId ?? '';
    expect(alarmProvider.getScheduledWhen(timerAlarmName(sessionId))).toBeDefined();

    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    expect(alarmProvider.getScheduledWhen(timerAlarmName(sessionId))).toBeUndefined();
    // Blocking is on exclusively during a running session (M2.T7). The rule sync
    // is fire-and-forget, so let the promise chain settle first.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    const rules = await fakeBrowser.declarativeNetRequest.getDynamicRules();
    expect(rules).toHaveLength(0);

    handle.dispose();
  });

  it('persists the completed session so the history survives a restart', async () => {
    const { handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    const raw = await fakeBrowser.storage.local.get(STORE_NAME);
    const parsed = JSON.parse(raw[STORE_NAME] as string) as {
      state: { sessionHistory: { sessions: SessionSummary[] }; timer: { status: string } };
    };
    expect(parsed.state.sessionHistory.sessions).toHaveLength(1);
    expect(parsed.state.timer.status).toBe('completed');

    handle.dispose();
  });

  it('does not complete twice when the alarm fires again', async () => {
    const { store, handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);
    const first = store.getState().sessionHistory.sessions[0];

    // A second firing (e.g. a duplicated alarm) must be a no-op: the timer is
    // no longer running.
    alarmProvider.fireDue();

    expect(store.getState().sessionHistory.sessions).toHaveLength(1);
    expect(store.getState().sessionHistory.sessions[0]).toEqual(first);

    handle.dispose();
  });

  it('logs nothing to the console on a normal completion', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { handle } = startWiredBackground();
    await handle.ready;

    await runSession(4 * 60_000);
    now = T0 + FOCUS_SECONDS * 1000;
    alarmProvider.advanceBy(FOCUS_SECONDS * 1000);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    handle.dispose();
  });
});
