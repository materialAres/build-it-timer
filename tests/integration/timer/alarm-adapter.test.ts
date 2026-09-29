import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  ALARM_MIN_TICK_MS,
  createBrowserAlarmProvider,
} from '@/lib/timer/alarm-adapter';

const tickAlarm = {
  name: 'tick',
  scheduledTime: 0,
  persistAcrossSessions: true,
};

describe('createBrowserAlarmProvider', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('schedules a browser alarm at the requested absolute time', async () => {
    const now = 1_000_000;
    const provider = createBrowserAlarmProvider(() => now);

    await provider.schedule('tick', now + 2 * ALARM_MIN_TICK_MS);

    const alarm = await fakeBrowser.alarms.get('tick');
    expect(alarm?.scheduledTime).toBe(now + 2 * ALARM_MIN_TICK_MS);
  });

  it('clamps a shorter-than-minimum interval up to the 60s tick', async () => {
    const now = 1_000_000;
    const provider = createBrowserAlarmProvider(() => now);

    await provider.schedule('tick', now + 1_000);

    const alarm = await fakeBrowser.alarms.get('tick');
    expect(alarm?.scheduledTime).toBe(now + ALARM_MIN_TICK_MS);
  });

  it('clamps a time in the past forward to now + 60s', async () => {
    const now = 5_000;
    const provider = createBrowserAlarmProvider(() => now);

    await provider.schedule('tick', 0);

    const alarm = await fakeBrowser.alarms.get('tick');
    expect(alarm?.scheduledTime).toBe(now + ALARM_MIN_TICK_MS);
  });

  it('clears a scheduled alarm', async () => {
    const provider = createBrowserAlarmProvider(() => 0);
    await provider.schedule('tick', ALARM_MIN_TICK_MS);

    await provider.clear('tick');

    await expect(fakeBrowser.alarms.get('tick')).resolves.toBeUndefined();
  });

  it('treats clearing a non-existent alarm as a no-op', async () => {
    const provider = createBrowserAlarmProvider(() => 0);
    await expect(provider.clear('missing')).resolves.toBeUndefined();
  });

  it('notifies registered listeners with the fired alarm name', async () => {
    const provider = createBrowserAlarmProvider(() => 0);
    const listener = vi.fn();
    provider.onFire(listener);

    await fakeBrowser.alarms.onAlarm.trigger(tickAlarm);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('tick');
  });

  it('stops notifying a listener after unsubscribe', async () => {
    const provider = createBrowserAlarmProvider(() => 0);
    const listener = vi.fn();
    const unsubscribe = provider.onFire(listener);

    unsubscribe();
    await fakeBrowser.alarms.onAlarm.trigger(tickAlarm);

    expect(listener).not.toHaveBeenCalled();
  });
});
