import type { Logger } from '@/utils/logger';

/**
 * Holds message deliveries until the startup work has settled, then runs them
 * in arrival order (PR5.T1). The gate opens once and stays open: it is not
 * `persist.hasHydrated()`, which every sync rehydration resets, so a later edit
 * is never held. A gate created for a store that has already hydrated has no
 * startup window to hold, so it starts open.
 */
export interface StartupGate {
  /** Runs `task` now when the gate is open, otherwise once it opens. */
  run(task: () => void): void;
  /** Opens the gate when `settled` settles, whether it resolves or rejects. */
  openAfter(settled: Promise<unknown>): void;
}

export function createStartupGate(
  logger: Logger,
  initiallyOpen: boolean,
): StartupGate {
  let open = initiallyOpen;
  const waiting: Array<() => void> = [];

  const runTask = (task: () => void): void => {
    try {
      task();
    } catch (error: unknown) {
      // Known boundary (§1.4): one failed delivery must not stop the ones behind it.
      logger.error('startup-gated task failed', error);
    }
  };

  const release = (): void => {
    // A task queued while draining is appended to `waiting` and picked up by
    // this loop, so arrival order holds. `open` flips only once the queue is
    // empty, so nothing can run ahead of a waiting task.
    let task = waiting.shift();
    while (task !== undefined) {
      runTask(task);
      task = waiting.shift();
    }
    open = true;
  };

  return {
    run(task: () => void): void {
      if (open) {
        runTask(task);
      } else {
        waiting.push(task);
      }
    },
    openAfter(settled: Promise<unknown>): void {
      void settled.then(release, release);
    },
  };
}
