import {
  clampAlarmWhen,
  type AlarmFiredListener,
  type AlarmProvider,
} from '@/lib/timer/alarm-adapter';

export interface FakeScheduledAlarm {
  readonly name: string;
  readonly whenMs: number;
}

/**
 * Deterministic, time-controllable `AlarmProvider` for tests. It honors the
 * same contract (including the 60s-minimum clamp, via `clampAlarmWhen`) as the
 * real `browser.alarms` provider, so it is a valid substitute (principle L),
 * but time only moves when the test calls `advanceBy`.
 *
 * Lives under `tests/` on purpose: it must never be pulled into the production
 * bundle (see the M1.T5 card).
 */
export class FakeAlarmProvider implements AlarmProvider {
  private nowMs: number;
  private readonly alarms = new Map<string, number>();
  private readonly listeners = new Set<AlarmFiredListener>();

  constructor(startMs = 0) {
    this.nowMs = startMs;
  }

  /** Current fake-clock value (epoch ms). */
  get now(): number {
    return this.nowMs;
  }

  /** Snapshot of the currently scheduled alarms, for assertions. */
  get scheduledAlarms(): ReadonlyArray<FakeScheduledAlarm> {
    return [...this.alarms.entries()].map(([name, whenMs]) => ({ name, whenMs }));
  }

  getScheduledWhen(name: string): number | undefined {
    return this.alarms.get(name);
  }

  schedule(name: string, whenMs: number): Promise<void> {
    this.alarms.set(name, clampAlarmWhen(whenMs, this.nowMs));
    return Promise.resolve();
  }

  clear(name: string): Promise<void> {
    this.alarms.delete(name);
    return Promise.resolve();
  }

  onFire(listener: AlarmFiredListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Advance the fake clock by `ms` and fire every alarm whose scheduled time
   * has been reached, in FIFO scheduling order. Returns the fired names.
   */
  advanceBy(ms: number): string[] {
    if (ms < 0) {
      throw new Error('Cannot advance the fake clock backwards');
    }
    this.nowMs += ms;
    return this.fireDue();
  }

  /** Fire all alarms already due at the current fake time, without advancing. */
  fireDue(): string[] {
    const due = [...this.alarms.entries()]
      .filter(([, whenMs]) => whenMs <= this.nowMs)
      .map(([name]) => name);

    for (const name of due) {
      this.alarms.delete(name);
    }
    for (const name of due) {
      for (const listener of [...this.listeners]) listener(name);
    }
    return due;
  }
}
