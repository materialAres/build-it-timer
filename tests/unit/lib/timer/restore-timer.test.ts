import { describe, it, expect } from 'vitest';
import { restoreTimer } from '@/lib/timer/restore-timer';
import { timerAlarmName } from '@/lib/timer/session';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import type { TimerState } from '@/store/store.types';

const T0 = 1_700_000_000_000;
const SESSION_ID = 'session-1';

const runningTimer: TimerState = {
  status: 'running',
  remainingSeconds: 1500,
  sessionStartedAt: T0,
  sessionId: SESSION_ID,
  endsAt: T0 + 1_500_000,
  focusedMs: 0,
      distractedMs: 0,
};

describe('restoreTimer (M2.T2)', () => {
  it('leaves an idle timer untouched and does not query the alarm', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    const idle: TimerState = {
      status: 'idle',
      remainingSeconds: 1500,
      sessionStartedAt: null,
      sessionId: null,
      endsAt: null,
      focusedMs: 0,
      distractedMs: 0,
    };

    const result = await restoreTimer(idle, { alarmProvider, now: () => T0 });

    expect(result.timer).toBe(idle);
    expect(result.changed).toBe(false);
  });

  it('leaves a paused timer untouched', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    const paused: TimerState = { ...runningTimer, status: 'paused' };

    const result = await restoreTimer(paused, { alarmProvider, now: () => T0 });

    expect(result.timer).toBe(paused);
    expect(result.changed).toBe(false);
  });

  it('recomputes remainingSeconds from the pending alarm after a restart', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    // The alarm was scheduled for the end of the session and survived the
    // restart; 5 minutes have elapsed since the session started.
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1500 * 1000);
    const now = T0 + 300 * 1000;

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => now });

    expect(result.timer.status).toBe('running');
    expect(result.timer.remainingSeconds).toBe(1200);
    expect(result.timer.sessionId).toBe(SESSION_ID);
    expect(result.changed).toBe(true);
  });

  it('reports no change when the persisted value already matches the alarm', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    // The alarm is due exactly at the persisted end time, and no time has
    // elapsed, so both the recomputed countdown and the projected end time are
    // identical to the persisted ones.
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1500 * 1000);

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => T0 });

    expect(result.timer).toBe(runningTimer);
    expect(result.changed).toBe(false);
  });

  it('re-derives the projected end time from the pending alarm (I001)', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0 + 1500 * 1000);
    const now = T0 + 300 * 1000;

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => now });

    // The alarm is authoritative: the popup's estimate must project from it,
    // not from the stale persisted value.
    expect(result.timer.endsAt).toBe(T0 + 1500 * 1000);
  });

  it('clears the projected end time when reverting to paused', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => T0 });

    expect(result.timer.status).toBe('paused');
    expect(result.timer.endsAt).toBeNull();
  });

  it('clamps to zero when the alarm is already due', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    // The fake clamps a past time to T0 + 60s; move the clock well past it.
    await alarmProvider.schedule(timerAlarmName(SESSION_ID), T0);
    const now = T0 + 120_000;

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => now });

    expect(result.timer.remainingSeconds).toBe(0);
    expect(result.changed).toBe(true);
  });

  it('reverts to paused when running but no alarm is pending (inconsistency)', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);

    const result = await restoreTimer(runningTimer, { alarmProvider, now: () => T0 });

    expect(result.timer.status).toBe('paused');
    expect(result.timer.sessionId).toBe(SESSION_ID);
    expect(result.changed).toBe(true);
  });

  it('reverts to paused when running but the session id is missing (corrupt state)', async () => {
    const alarmProvider = new FakeAlarmProvider(T0);
    const corrupt: TimerState = { ...runningTimer, sessionId: null };

    const result = await restoreTimer(corrupt, { alarmProvider, now: () => T0 });

    expect(result.timer.status).toBe('paused');
    expect(result.changed).toBe(true);
  });
});
