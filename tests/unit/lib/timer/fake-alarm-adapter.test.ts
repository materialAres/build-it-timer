import { describe, it, expect, vi } from 'vitest';
import { ALARM_MIN_TICK_MS } from '@/lib/timer/alarm-adapter';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

describe('FakeAlarmProvider', () => {
  it('fires a subscribed listener when its alarm time is reached', async () => {
    const provider = new FakeAlarmProvider(0);
    const listener = vi.fn();
    provider.onFire(listener);

    await provider.schedule('tick', ALARM_MIN_TICK_MS);
    const fired = provider.advanceBy(ALARM_MIN_TICK_MS);

    expect(fired).toEqual(['tick']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('tick');
  });

  it('does not fire before the scheduled time', async () => {
    const provider = new FakeAlarmProvider(0);
    const listener = vi.fn();
    provider.onFire(listener);

    await provider.schedule('tick', ALARM_MIN_TICK_MS);
    const fired = provider.advanceBy(ALARM_MIN_TICK_MS - 1);

    expect(fired).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('clamps a shorter-than-minimum interval up to 60s', async () => {
    const provider = new FakeAlarmProvider(1_000_000);

    await provider.schedule('tick', 1_000_000 + 1_000);

    expect(provider.getScheduledWhen('tick')).toBe(1_000_000 + ALARM_MIN_TICK_MS);
  });

  it('clamps a time in the past forward to now + 60s', async () => {
    const provider = new FakeAlarmProvider(5_000);

    await provider.schedule('tick', 0);

    expect(provider.getScheduledWhen('tick')).toBe(5_000 + ALARM_MIN_TICK_MS);
  });

  it('keeps an alarm scheduled further in the future unchanged', async () => {
    const provider = new FakeAlarmProvider(0);

    await provider.schedule('tick', 5 * ALARM_MIN_TICK_MS);

    expect(provider.getScheduledWhen('tick')).toBe(5 * ALARM_MIN_TICK_MS);
  });

  it('does not fire a cleared alarm', async () => {
    const provider = new FakeAlarmProvider(0);
    const listener = vi.fn();
    provider.onFire(listener);

    await provider.schedule('tick', ALARM_MIN_TICK_MS);
    await provider.clear('tick');
    const fired = provider.advanceBy(ALARM_MIN_TICK_MS);

    expect(fired).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('treats clearing a non-existent alarm as a no-op', async () => {
    const provider = new FakeAlarmProvider(0);
    await expect(provider.clear('missing')).resolves.toBeUndefined();
  });

  it('stops notifying a listener after unsubscribe', async () => {
    const provider = new FakeAlarmProvider(0);
    const listener = vi.fn();
    const unsubscribe = provider.onFire(listener);

    unsubscribe();
    await provider.schedule('tick', ALARM_MIN_TICK_MS);
    provider.advanceBy(ALARM_MIN_TICK_MS);

    expect(listener).not.toHaveBeenCalled();
  });

  it('fires multiple due alarms deterministically in scheduling order', async () => {
    const provider = new FakeAlarmProvider(0);
    const fired: string[] = [];
    provider.onFire((name) => fired.push(name));

    await provider.schedule('first', ALARM_MIN_TICK_MS);
    await provider.schedule('second', ALARM_MIN_TICK_MS);

    const result = provider.advanceBy(ALARM_MIN_TICK_MS);

    expect(result).toEqual(['first', 'second']);
    expect(fired).toEqual(['first', 'second']);
  });

  it('rejects advancing the clock backwards', () => {
    const provider = new FakeAlarmProvider(1_000);
    expect(() => provider.advanceBy(-1)).toThrow();
  });

  it('lists the currently scheduled alarms', async () => {
    const provider = new FakeAlarmProvider(0);
    await provider.schedule('a', ALARM_MIN_TICK_MS);

    expect(provider.scheduledAlarms).toEqual([
      { name: 'a', whenMs: ALARM_MIN_TICK_MS },
    ]);
  });
});
