import {
  createAppStore,
  attachStoreSync,
  addSiteToList,
  removeSiteFromList,
  upsertTag,
  removeTag,
  type AppStore,
  type BlocklistListName,
  type BlocklistState,
} from '@/store';
import {
  createBrowserAlarmProvider,
  type AlarmProvider,
} from '@/lib/timer/alarm-adapter';
import { restoreTimer } from '@/lib/timer/restore-timer';
import {
  createBlockingRulesSync,
  createBrowserRuleApplier,
  type RuleApplier,
} from '@/lib/blocking/apply-rules';
import { onMessage, type MessageType } from '@/lib/messaging/bus';
import {
  MUTATION_TYPES,
  type MutationMessage,
} from '@/lib/messaging/messages.types';
import type { Tag } from '@/store/store.types';

/**
 * The passive `RuntimeMessage` variants defined in M1.T1. The background
 * registers one listener per type, so the wiring is complete before the
 * business logic lands in M2 (M2.T2 timer restore, M2.T7 DNR, M2.T15 growth,
 * M2.T16 malus).
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
  /** Dynamic-rules applier (M2.T7). Injectable for tests. */
  readonly ruleApplier?: RuleApplier;
}

export interface BackgroundHandle {
  readonly store: AppStore;
  readonly alarmProvider: AlarmProvider;
  /**
   * Resolves once the startup reconciliation (M2.T2) has been applied to the
   * store. Tests await it to observe the restored state deterministically.
   */
  readonly ready: Promise<void>;
  /** Detach every listener registered by `startBackground` (used by tests). */
  dispose(): void;
}

// Wiring only (M1.T7): the concrete behavior of each listener is owned by the
// M2 tasks. Keeping a single placeholder avoids six near-identical no-ops while
// still registering a distinct listener per message type.
function handlePlaceholder(): void {
  // Intentionally empty: the background skeleton only wires the listeners.
}

function isListName(value: unknown): value is BlocklistListName {
  return value === 'allowlist' || value === 'blocklist';
}

function isTag(value: unknown): value is Tag {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; label?: unknown };
  return typeof candidate.id === 'string' && typeof candidate.label === 'string';
}

/**
 * Apply one mutation to the blocklist state. Returns the *same* reference when
 * the payload is malformed or unknown, so an invalid message neither mutates the
 * store nor triggers a persist (forward-compatible with M5.T1 hardening).
 *
 * The semantics stay deliberately minimal here: normalization (M2.T4/M2.T21),
 * dedup and allowlist precedence (M2.T20), preset expansion (M2.T5) and the DNR
 * side-effect (M2.T7) are owned by those tasks.
 */
function applyMutation(state: BlocklistState, message: MutationMessage): BlocklistState {
  switch (message.type) {
    case 'BLOCKLIST_ADD_SITE': {
      const { list, site } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || site.length === 0) return state;
      return addSiteToList(state, list, site);
    }
    case 'BLOCKLIST_REMOVE_SITE': {
      const { list, site } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || site.length === 0) return state;
      return removeSiteFromList(state, list, site);
    }
    case 'BLOCKLIST_APPLY_PRESET':
      // Preset expansion needs the preset dataset (M2.T5); until then the
      // message is accepted but has no effect on the state.
      return state;
    case 'TAG_UPSERT': {
      if (!isTag(message.payload)) return state;
      return upsertTag(state, message.payload);
    }
    case 'TAG_REMOVE': {
      const { tagId } = message.payload;
      if (typeof tagId !== 'string' || tagId.length === 0) return state;
      return removeTag(state, tagId);
    }
    default:
      return state;
  }
}

/**
 * Mutation handler for the cross-context path (M1.T10): the popup sends a typed
 * mutation, the background applies it to its single writable store (M1.T9) and
 * the change propagates back to the popup through the M1.T8 sync bridge.
 */
function handleMutation(store: AppStore) {
  return (message: MutationMessage): void => {
    const current = store.getState().blocklist;
    const next = applyMutation(current, message);
    // Identity check: an invalid or no-op payload must not persist (one write
    // per accepted mutation, none for a rejected one).
    if (next === current) return;
    store.setState({ blocklist: next });
  };
}

/**
 * Growth wiring (M2.T15): the fine-grained character-insertion tick arrives as
 * the typed `TIMER_TICK` message from the active context (popup) — the 2s tick
 * of the §1 "two distinct clocks" note, deliberately separate from the 60s
 * `browser.alarms` countdown clock (M1.T5).
 *
 * On each tick the *undistracted* focus time elapsed since the previous tick is
 * measured with the injected clock and handed to `citySlice.growCity` (M2.T11),
 * which delegates to the session-seeded engine (M2.T12). A tick that arrives
 * while the timer is not `running` neither grows the city nor moves the
 * baseline, so paused/idle time is never counted as focus time. The baseline is
 * set to "now" on the first tick of a running stretch (never to
 * `sessionStartedAt`), so a service-worker restart cannot replay the whole
 * session into the city a second time.
 */
export interface GrowthTickHandle {
  /** Handle one `TIMER_TICK` (the tick handler wired into the message bus). */
  handleTick(): void;
  /** Detach the status subscription owned by the tracker. */
  dispose(): void;
}

function createGrowthTick(store: AppStore, now: () => number): GrowthTickHandle {
  let lastGrowthAt: number | null = null;
  let status = store.getState().timer.status;

  // Detect the transitions into/out of `running` even when no tick arrives:
  // resuming must start measuring from the resume moment, not from the last
  // running tick before the pause (otherwise the paused gap would count as focus).
  const unsubscribe = store.subscribe(() => {
    const next = store.getState().timer.status;
    if (next === status) return;
    status = next;
    lastGrowthAt = next === 'running' ? now() : null;
  });

  const handleTick = (): void => {
    const { timer } = store.getState();
    if (timer.status !== 'running') {
      lastGrowthAt = null;
      return;
    }
    const current = now();
    const baseline = lastGrowthAt ?? current;
    lastGrowthAt = current;
    const elapsed = current - baseline;
    if (elapsed <= 0) return;
    store.getState().growCity(elapsed);
  };

  return { handleTick, dispose: unsubscribe };
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
  // The background is the single writer of the persisted store (M1.T9): it owns
  // the writable instance, while every other context gets a read-only one.
  //
  // The alarm provider is created first and injected into the store (M2.T1), so
  // the slice schedules the session alarm on the same instance the orchestrator
  // subscribes to: two providers would mean the alarm fires into a void.
  const alarmProvider =
    dependencies.alarmProvider ?? createBrowserAlarmProvider(dependencies.now);
  const now = dependencies.now ?? Date.now;
  const store =
    dependencies.store ??
    createAppStore({ dependencies: { alarmProvider, now } });

  // Dynamic DNR rules (M2.T7): the browser's ruleset is a projection of the
  // store, so it is recomputed from *state* rather than patched at each call
  // site. The sync itself is idempotent, so subscribing to every change is safe
  // — a state change that does not alter the rules (a timer tick) is skipped.
  const rulesSync = createBlockingRulesSync(
    dependencies.ruleApplier ?? createBrowserRuleApplier(),
  );

  const syncRules = (): void => {
    void rulesSync.sync(store.getState()).catch((error: unknown) => {
      // Known boundary (§1.4): a failed rule update must not crash the worker.
      console.error('[background] DNR rule sync failed', error);
    });
  };

  const disposers: Array<() => void> = [];

  // Converge on writes made by other contexts (popup, content script): the
  // background's store rehydrates whenever the persisted key changes (M1.T8).
  disposers.push(attachStoreSync(store));

  // Growth across the timer ticks (M2.T15): the tracker owns the running/idle
  // baseline used to size each `growCity` delta.
  const growthTick = createGrowthTick(store, now);
  disposers.push(() => {
    growthTick.dispose();
  });

  for (const type of MESSAGE_TYPES) {
    const handler =
      type === 'TIMER_TICK'
        ? (): void => {
            growthTick.handleTick();
          }
        : handlePlaceholder;
    disposers.push(onMessage(type, handler));
  }

  // Cross-context mutations (M1.T10): the popup requests, the background applies.
  for (const type of MUTATION_TYPES) {
    disposers.push(onMessage(type, handleMutation(store)));
  }

  // Any change to the blocklist/allowlist or to the timer status re-evaluates
  // the active rules (M2.T7).
  disposers.push(store.subscribe(syncRules));

  // The alarm provider is wired now so the background owns a single instance for
  // the whole session: the timer slice (M2.T1) schedules the session alarm on it
  // and this subscription receives the firing. Rebuilding the countdown from the
  // persisted state when that happens is M2.T2.
  disposers.push(alarmProvider.onFire(handlePlaceholder));

  // Startup reconciliation (M2.T2): the persisted store may say `running` while
  // the worker was asleep, so the countdown is rebuilt from the still-pending
  // alarm (or the timer is reverted to `paused` if that alarm is gone). The
  // store must be hydrated first, otherwise the persisted timer is not in memory
  // yet and the reconciliation would see the default idle state.
  const ready = (async (): Promise<void> => {
    await store.persist.rehydrate();
    const { timer } = store.getState();
    const restored = await restoreTimer(timer, {
      alarmProvider,
      now,
    });
    if (restored.changed) store.setState({ timer: restored.timer });
    // Awaited so `ready` also means "the dynamic ruleset reflects the restored
    // state": a session that did not survive the restart must not leave the
    // previous session's blocking rules active.
    await rulesSync.sync(store.getState());
  })().catch((error: unknown) => {
    // The startup path is a known boundary (§1.4): a failure here must not
    // become an unhandled rejection that kills the service worker. Logged with
    // context; centralized logging replaces this in M4.T3.
    console.error('[background] startup reconciliation failed', error);
  });

  return {
    store,
    alarmProvider,
    ready,
    dispose(): void {
      for (const dispose of disposers) dispose();
      disposers.length = 0;
    },
  };
}

export default defineBackground(() => {
  startBackground();
});
