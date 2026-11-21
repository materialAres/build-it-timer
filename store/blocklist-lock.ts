import type { TimerStatus } from './store.types';

// The blocklist lock (CR2) and its add-only window (CR5). Two pure predicates
// so the store, the background and the UI cannot drift apart.

/**
 * Whether the blocklist may be reshaped (CR2.T1): removing a site, switching a
 * preset off, saving/renaming/deleting a preset. Editing is configuration for
 * the *next* session: once the timer leaves `idle` — running, paused or even
 * completed — loosening the list would let the user escape the block they
 * asked for.
 */
export function isBlocklistEditable(status: TimerStatus): boolean {
  return status === 'idle';
}

/**
 * Whether the list may *grow* (CR5.T1): adding a site or switching a preset on.
 * Tightening the block is no escape, so it is also allowed mid-session; a
 * `completed` session stays locked because the block it protected is over and
 * Reset is the next step.
 */
export function isBlocklistAddAllowed(status: TimerStatus): boolean {
  return status !== 'completed';
}

/**
 * The part of the app state the lock decisions read, declared structurally so
 * the selectors do not depend on the concrete store shape.
 */
export interface BlocklistLockSource {
  readonly timer: { readonly status: TimerStatus };
}

export const selectBlocklistEditable = (state: BlocklistLockSource): boolean =>
  isBlocklistEditable(state.timer.status);

export const selectBlocklistAddAllowed = (
  state: BlocklistLockSource,
): boolean => isBlocklistAddAllowed(state.timer.status);
