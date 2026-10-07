import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';

/**
 * The fine-grained character-insertion tick (M2.T15, §1 "two distinct clocks").
 *
 * The 2s cadence is deliberately *not* a `browser.alarms` alarm: the platform
 * cannot wake an MV3 service worker more often than once per minute (M1.T5), so
 * the countdown's persistence stays on the 60s alarm while the city's growth is
 * driven by this finer tick. The background consumes the tick and measures the
 * elapsed focus time itself, so a missed or late tick only delays growth — it
 * never loses or duplicates characters.
 */
export const TICK_INTERVAL_MS = GROWTH_TICK_MS;

export interface TickEmitterDependencies {
  /** Sink for one tick; the popup wires it to `sendMessage({ type: 'TIMER_TICK' })`. */
  readonly send: () => void;
  /** Cadence in ms; defaults to the 2s growth tick. */
  readonly intervalMs?: number;
  /** Scheduler, injectable so tests drive the cadence deterministically. */
  readonly setIntervalFn?: (handler: () => void, ms: number) => number;
  readonly clearIntervalFn?: (handle: number) => void;
}

export interface TickEmitter {
  /** Begin emitting; a second call while already running is a no-op. */
  start(): void;
  /** Stop emitting; safe to call when not running. */
  stop(): void;
  /** Whether the emitter currently holds a scheduled interval. */
  readonly isRunning: boolean;
}

/**
 * Periodic `TIMER_TICK` emitter (M3.T3b). It owns no timer state and makes no
 * decision about *whether* a tick should count: the background's growth wiring
 * (M2.T15) already ignores a tick that arrives while the session is not
 * `running`, so the emitter can stay a dumb clock.
 *
 * Pure with respect to its dependencies (§1.4): the scheduler is injected, so
 * the cadence is testable without fake timers and the module never touches
 * `window`/`globalThis` directly.
 */
export function createTickEmitter({
  send,
  intervalMs = TICK_INTERVAL_MS,
  setIntervalFn = (handler, ms) => globalThis.setInterval(handler, ms) as unknown as number,
  clearIntervalFn = (handle) => {
    globalThis.clearInterval(handle);
  },
}: TickEmitterDependencies): TickEmitter {
  let handle: number | null = null;

  return {
    start(): void {
      if (handle !== null) return;
      handle = setIntervalFn(send, intervalMs);
    },
    stop(): void {
      if (handle === null) return;
      clearIntervalFn(handle);
      handle = null;
    },
    get isRunning(): boolean {
      return handle !== null;
    },
  };
}
