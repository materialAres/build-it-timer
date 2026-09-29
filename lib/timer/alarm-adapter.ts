import { browser } from 'wxt/browser';

// `browser.alarms` cannot reliably wake the MV3 service worker more often than
// once per minute: a finer tick would be silently coalesced or dropped by the
// platform. Requests for a shorter interval are therefore clamped up to this
// value. The second-by-second countdown shown in the popup is estimated on the
// UI side between two ticks and reconciled at the next alarm (see the
// "two distinct clocks" note in §1).
export const ALARM_MIN_TICK_MS = 60_000;

export type AlarmFiredListener = (name: string) => void;

/**
 * Abstraction over the browser alarm scheduler (dependency inversion, principle
 * D). The rest of `lib/` depends only on this interface, never on
 * `browser.alarms` directly, so it can be substituted by a fake in tests
 * (principle L).
 */
export interface AlarmProvider {
  /**
   * Schedule (or reschedule) a one-shot alarm at the absolute epoch time
   * `whenMs`. Times closer than the 60s platform minimum are clamped forward.
   */
  schedule(name: string, whenMs: number): Promise<void>;
  /** Cancel a scheduled alarm. A missing alarm is a safe no-op. */
  clear(name: string): Promise<void>;
  /** Subscribe to alarm firings. Returns an unsubscribe function. */
  onFire(listener: AlarmFiredListener): () => void;
}

// Shared by the real and fake providers so both honor the same 60s-minimum
// contract (principle L: the fake is substitutable for the real provider).
export function clampAlarmWhen(whenMs: number, nowMs: number): number {
  return Math.max(whenMs, nowMs + ALARM_MIN_TICK_MS);
}

/**
 * Real `AlarmProvider` backed by `browser.alarms`. `now` is injectable so the
 * clamping is testable deterministically without touching the wall clock.
 */
export function createBrowserAlarmProvider(
  now: () => number = Date.now,
): AlarmProvider {
  const listeners = new Set<AlarmFiredListener>();

  const handleAlarm = (alarm: { name: string }): void => {
    for (const listener of [...listeners]) listener(alarm.name);
  };

  return {
    async schedule(name: string, whenMs: number): Promise<void> {
      await browser.alarms.create(name, { when: clampAlarmWhen(whenMs, now()) });
    },
    async clear(name: string): Promise<void> {
      await browser.alarms.clear(name);
    },
    onFire(listener: AlarmFiredListener): () => void {
      if (listeners.size === 0) {
        browser.alarms.onAlarm.addListener(handleAlarm);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          browser.alarms.onAlarm.removeListener(handleAlarm);
        }
      };
    },
  };
}
