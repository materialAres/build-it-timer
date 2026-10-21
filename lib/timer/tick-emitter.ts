/**
 * The fine-grained character-insertion tick (M2.T15, §1 "two distinct clocks").
 *
 * The cadence here is a fixed *sampling* interval, deliberately NOT the growth
 * cadence: how many ms equal one character is a per-session value derived from
 * the chosen duration (`lib/timer/focus-presets.ts`). The background measures
 * the elapsed focus time itself and converts it to whole session ticks, so the
 * sampling interval only bounds how promptly a due character appears — a missed
 * or late tick delays growth, it never loses or duplicates characters. Sampling
 * faster than the platform's 60s alarm minimum is why this is not a
 * `browser.alarms` alarm (M1.T5).
 */
export const SAMPLE_INTERVAL_MS = 1_000;
export const TICK_INTERVAL_MS = SAMPLE_INTERVAL_MS;

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
