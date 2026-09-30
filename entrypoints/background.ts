import { createAppStore, attachStoreSync, type AppStore } from '@/store';
import {
  createBrowserAlarmProvider,
  type AlarmProvider,
} from '@/lib/timer/alarm-adapter';
import { onMessage, type MessageType } from '@/lib/messaging/bus';

/**
 * Every `RuntimeMessage` variant defined in M1.T1. The background registers one
 * listener per type, so the wiring is complete before the business logic lands
 * in M2 (M2.T2 timer restore, M2.T7 DNR, M2.T15 growth, M2.T16 malus).
 */
export const MESSAGE_TYPES = [
  'TIMER_TICK',
  'TIMER_STARTED',
  'TIMER_PAUSED',
  'SITE_BLOCKED_ATTEMPT',
  'MALUS_APPLIED',
  'SESSION_ENDED',
] as const satisfies ReadonlyArray<MessageType>;

export interface BackgroundDependencies {
  /** Writable store owned by the background (M1.T9). Injectable for tests. */
  readonly store?: AppStore;
  /** Alarm scheduler (M1.T5). Injectable for tests. */
  readonly alarmProvider?: AlarmProvider;
  /** Clock used by the real alarm provider; injectable for determinism. */
  readonly now?: () => number;
}

export interface BackgroundHandle {
  readonly store: AppStore;
  readonly alarmProvider: AlarmProvider;
  /** Detach every listener registered by `startBackground` (used by tests). */
  dispose(): void;
}

// Wiring only (M1.T7): the concrete behavior of each listener is owned by the
// M2 tasks. Keeping a single placeholder avoids six near-identical no-ops while
// still registering a distinct listener per message type.
function handlePlaceholder(): void {
  // Intentionally empty: the background skeleton only wires the listeners.
}

/**
 * Wiring-only orchestrator (M1.T7): it creates the background's writable store
 * and alarm provider and registers the typed message listeners. It deliberately
 * contains no business logic, so the background can start cleanly and be tested
 * in isolation.
 */
export function startBackground(
  dependencies: BackgroundDependencies = {},
): BackgroundHandle {
  const store = dependencies.store ?? createAppStore();
  const alarmProvider =
    dependencies.alarmProvider ?? createBrowserAlarmProvider(dependencies.now);

  const disposers: Array<() => void> = [];

  // Converge on writes made by other contexts (popup, content script): the
  // background's store rehydrates whenever the persisted key changes (M1.T8).
  disposers.push(attachStoreSync(store));

  for (const type of MESSAGE_TYPES) {
    disposers.push(onMessage(type, handlePlaceholder));
  }

  // The alarm provider is wired now so the background owns a single instance for
  // the whole session; the countdown logic itself lands in M2.T2.
  disposers.push(alarmProvider.onFire(handlePlaceholder));

  return {
    store,
    alarmProvider,
    dispose(): void {
      for (const dispose of disposers) dispose();
      disposers.length = 0;
    },
  };
}

export default defineBackground(() => {
  startBackground();
});
