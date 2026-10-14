import { describe, it, expect, vi } from 'vitest';
import { createTickEmitter, TICK_INTERVAL_MS } from '@/lib/timer/tick-emitter';
import { GROWTH_TICK_MS } from '@/lib/city/growth-engine';

/** Minimal manual scheduler so the cadence is driven without fake timers. */
function createManualScheduler() {
  let nextHandle = 1;
  const scheduled = new Map<number, { handler: () => void; ms: number }>();

  return {
    setIntervalFn: (handler: () => void, ms: number): number => {
      const handle = nextHandle++;
      scheduled.set(handle, { handler, ms });
      return handle;
    },
    clearIntervalFn: (handle: number): void => {
      scheduled.delete(handle);
    },
    /** Fire every scheduled interval once. */
    fire(): void {
      for (const { handler } of [...scheduled.values()]) handler();
    },
    get size(): number {
      return scheduled.size;
    },
    get intervalMs(): number | undefined {
      return [...scheduled.values()][0]?.ms;
    },
  };
}

describe('tick emitter (M3.T3b)', () => {
  it('uses the 2s growth cadence by default', () => {
    const scheduler = createManualScheduler();
    const emitter = createTickEmitter({
      send: vi.fn(),
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    emitter.start();

    expect(TICK_INTERVAL_MS).toBe(GROWTH_TICK_MS);
    expect(scheduler.intervalMs).toBe(GROWTH_TICK_MS);
  });

  it('emits one tick per interval firing', () => {
    const scheduler = createManualScheduler();
    const send = vi.fn();
    const emitter = createTickEmitter({
      send,
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    emitter.start();
    scheduler.fire();
    scheduler.fire();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not emit before start', () => {
    const scheduler = createManualScheduler();
    const send = vi.fn();
    createTickEmitter({
      send,
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    scheduler.fire();

    expect(send).not.toHaveBeenCalled();
  });

  it('is idempotent: a second start does not schedule a second interval', () => {
    const scheduler = createManualScheduler();
    const emitter = createTickEmitter({
      send: vi.fn(),
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    emitter.start();
    emitter.start();

    expect(scheduler.size).toBe(1);
  });

  it('stops emitting after stop and is safe to stop twice', () => {
    const scheduler = createManualScheduler();
    const send = vi.fn();
    const emitter = createTickEmitter({
      send,
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    emitter.start();
    emitter.stop();
    emitter.stop();
    scheduler.fire();

    expect(send).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
  });

  it('can be restarted after a stop', () => {
    const scheduler = createManualScheduler();
    const send = vi.fn();
    const emitter = createTickEmitter({
      send,
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    emitter.start();
    emitter.stop();
    emitter.start();
    scheduler.fire();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports whether it is running', () => {
    const scheduler = createManualScheduler();
    const emitter = createTickEmitter({
      send: vi.fn(),
      setIntervalFn: scheduler.setIntervalFn,
      clearIntervalFn: scheduler.clearIntervalFn,
    });

    expect(emitter.isRunning).toBe(false);
    emitter.start();
    expect(emitter.isRunning).toBe(true);
    emitter.stop();
    expect(emitter.isRunning).toBe(false);
  });
});
