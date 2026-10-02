import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { createAppStore, DEFAULT_FOCUS_SECONDS } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';
import { generateSessionId } from '@/lib/timer/session';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

const START_MS = 1_700_000_000_000;

/** Narrow a nullable session id without a non-null assertion (lint forbids `!`). */
function requireSessionId(value: string | null): string {
  if (value === null) throw new Error('expected a session id');
  return value;
}

describe('timerSlice (M2.T1)', () => {
  let alarmProvider: FakeAlarmProvider;
  let nowMs: number;
  let randomSequence: number;

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: {
        alarmProvider,
        now: () => nowMs,
        random: () => {
          randomSequence += 1;
          return randomSequence / 100;
        },
      },
    });

  beforeEach(() => {
    fakeBrowser.reset();
    alarmProvider = new FakeAlarmProvider(START_MS);
    nowMs = START_MS;
    randomSequence = 0;
  });

  it('starts idle at the default focus duration', () => {
    const { timer } = createStore().getState();

    expect(timer.status).toBe('idle');
    expect(timer.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(timer.sessionStartedAt).toBeNull();
    expect(timer.sessionId).toBeNull();
  });

  it('startTimer moves to running, stamps the session and schedules the alarm', async () => {
    const store = createStore();

    await store.getState().startTimer();

    const { timer } = store.getState();
    const sessionId = requireSessionId(timer.sessionId);
    expect(timer.status).toBe('running');
    expect(timer.sessionStartedAt).toBe(START_MS);
    // One alarm, named after the session, due when the countdown reaches zero.
    expect(alarmProvider.scheduledAlarms).toEqual([
      { name: timerAlarmName(sessionId), whenMs: START_MS + DEFAULT_FOCUS_SECONDS * 1000 },
    ]);
  });

  it('startTimer is idempotent while already running', async () => {
    const store = createStore();
    await store.getState().startTimer();
    const running = store.getState().timer;

    await store.getState().startTimer();

    expect(store.getState().timer).toBe(running);
    expect(alarmProvider.scheduledAlarms).toHaveLength(1);
  });

  it('startTimer after pause resumes the same session without resetting progress', async () => {
    const store = createStore();
    await store.getState().startTimer();
    const sessionId = requireSessionId(store.getState().timer.sessionId);
    await store.getState().pauseTimer();

    nowMs = START_MS + 5 * 60_000;
    await store.getState().startTimer();

    const { timer } = store.getState();
    expect(timer.status).toBe('running');
    expect(timer.sessionId).toBe(sessionId);
    expect(timer.sessionStartedAt).toBe(START_MS);
    expect(timer.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    // Resuming re-arms the alarm from *now*, not from the original start time.
    expect(alarmProvider.getScheduledWhen(timerAlarmName(sessionId))).toBe(
      nowMs + DEFAULT_FOCUS_SECONDS * 1000,
    );
  });

  it('startTimer after reset opens a new unique session', async () => {
    const store = createStore();
    await store.getState().startTimer();
    const firstSessionId = requireSessionId(store.getState().timer.sessionId);

    await store.getState().resetTimer();
    await store.getState().startTimer();

    const secondSessionId = requireSessionId(store.getState().timer.sessionId);
    expect(secondSessionId).not.toBe(firstSessionId);
  });

  it('pauseTimer moves running to paused and clears the pending alarm', async () => {
    const store = createStore();
    await store.getState().startTimer();
    const sessionId = requireSessionId(store.getState().timer.sessionId);

    await store.getState().pauseTimer();

    const { timer } = store.getState();
    expect(timer.status).toBe('paused');
    expect(timer.sessionId).toBe(sessionId);
    expect(alarmProvider.getScheduledWhen(timerAlarmName(sessionId))).toBeUndefined();
  });

  it('pauseTimer while idle is a safe no-op', async () => {
    const store = createStore();
    const idle = store.getState().timer;
    const clear = vi.spyOn(alarmProvider, 'clear');

    await store.getState().pauseTimer();

    expect(store.getState().timer).toBe(idle);
    expect(clear).not.toHaveBeenCalled();
  });

  it('pauseTimer while already paused is a no-op', async () => {
    const store = createStore();
    await store.getState().startTimer();
    await store.getState().pauseTimer();
    const paused = store.getState().timer;
    const clear = vi.spyOn(alarmProvider, 'clear');

    await store.getState().pauseTimer();

    expect(store.getState().timer).toBe(paused);
    expect(clear).not.toHaveBeenCalled();
  });

  it('resetTimer returns to the initial state and drops the pending alarm', async () => {
    const store = createStore();
    await store.getState().startTimer();

    await store.getState().resetTimer();

    const { timer } = store.getState();
    expect(timer.status).toBe('idle');
    expect(timer.remainingSeconds).toBe(DEFAULT_FOCUS_SECONDS);
    expect(timer.sessionStartedAt).toBeNull();
    expect(timer.sessionId).toBeNull();
    expect(alarmProvider.scheduledAlarms).toEqual([]);
  });

  it('delegates to the injected provider instead of touching browser.alarms', async () => {
    const create = vi.spyOn(browser.alarms, 'create');
    const clear = vi.spyOn(browser.alarms, 'clear');
    const store = createStore();

    await store.getState().startTimer();
    await store.getState().pauseTimer();
    await store.getState().resetTimer();

    expect(create).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});

describe('session helpers (M2.T1)', () => {
  it('derives a session id deterministically from the injected clock and entropy', () => {
    expect(generateSessionId(42, () => 0.5)).toBe(generateSessionId(42, () => 0.5));
  });

  it('produces different ids for different entropy', () => {
    expect(generateSessionId(42, () => 0.1)).not.toBe(generateSessionId(42, () => 0.2));
  });

  it('namespaces the alarm name by session id', () => {
    expect(timerAlarmName('session-1')).not.toBe(timerAlarmName('session-2'));
  });
});
