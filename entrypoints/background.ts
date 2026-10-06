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
import { onMessage, sendMessage, type MessageType } from '@/lib/messaging/bus';
import {
  MUTATION_TYPES,
  type MutationMessage,
  type RuntimeMessage,
} from '@/lib/messaging/messages.types';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import { getRegistrableDomain } from '@/lib/url/domain';
import {
  createBrowserTabEventSource,
  createTabDistractionTracker,
  type TabDistractionTracker,
  type TabEventSource,
} from '@/lib/timer/tab-distraction-tracker';
import type { CityLayers } from '@/components/city/city.types';
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
  /** Tab event source for distraction tracking (M2.T10/M2.T16). */
  readonly tabEventSource?: TabEventSource;
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
 * How many characters the three layers currently hold. Used only to report how
 * many characters a malus application actually removed (a pending tick against
 * an already-empty city removes none).
 */
function countOccupied(layers: CityLayers): number {
  return [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );
}

/**
 * Whether an open tab is a distraction right now: a blocked, canonical domain
 * while a focus session is running. Reuses `isDomainBlocked` (M2.T8) so the
 * allowlist-wins precedence (M2.T6) is not reimplemented.
 */
function createDistractionPredicate(store: AppStore): (url: string | undefined) => boolean {
  return (url) => {
    if (url === undefined) return false;
    const { timer, blocklist } = store.getState();
    if (timer.status !== 'running') return false;
    const parsed = getRegistrableDomain(url);
    if (!parsed.ok) return false;
    return isDomainBlocked(blocklist, parsed.value);
  };
}

export interface MalusWiring {
  /** React to the overlay's answer (M2.T8): only `proceed` starts the malus. */
  handleAttempt(message: Extract<RuntimeMessage, { type: 'SITE_BLOCKED_ATTEMPT' }>): void;
  /** Apply the distraction ticks accrued since the previous call. */
  handleTick(): void;
  /** Detach the session subscription owned by the wiring. */
  dispose(): void;
}

export interface MalusWiringDependencies {
  readonly store: AppStore;
  /** Distraction clock source; only the tick count is consumed. */
  readonly tracker: Pick<TabDistractionTracker, 'getTicks'>;
  /** Message sink, injectable so the wiring is testable without the bus. */
  readonly send?: (message: RuntimeMessage) => void;
}

const defaultSend = (message: RuntimeMessage): void => {
  void sendMessage(message);
};

/**
 * Malus wiring (M2.T16): connect the `SITE_BLOCKED_ATTEMPT` ("proceed") event
 * (M2.T8) and the accumulated distraction ticks (M2.T10) to the city store
 * (M2.T11), instead of the pure `applyMalus` model.
 *
 * The malus is one continuous stretch per focus session: choosing "proceed"
 * removes the first character immediately (the store must reflect the
 * destruction in the same update cycle, roadmap M2.T16); every subsequent 2s
 * distraction tick removes one more. A second `proceed` in close succession —
 * e.g. the overlay re-mounting on a blocked navigation (M2.T8) — does **not**
 * double-apply, because the stretch is already active. A new session resets the
 * stretch so the previous session's malus cannot bleed into the new city.
 *
 * The pre-`proceed` open time of the blocked tab is deliberately forgiven: the
 * baseline is captured at the "proceed" choice, because the malus starts only
 * after the user decides to enter (roadmap M2.T10).
 */
export function createMalusWiring({
  store,
  tracker,
  send = defaultSend,
}: MalusWiringDependencies): MalusWiring {
  let active = false;
  let baselineTicks = 0;
  let applied = 0;
  let domain = '';
  let sessionId = store.getState().city.sessionId;

  const unsubscribe = store.subscribe(() => {
    const next = store.getState().city.sessionId;
    if (next === sessionId) return;
    sessionId = next;
    active = false;
    baselineTicks = 0;
    applied = 0;
  });

  // The remove rule lives in `applyMalus` (M2.T10): this only decides how many
  // ticks are due and hands them to the slice, which never computes.
  const pump = (): void => {
    if (!active) return;
    const expected = 1 + (tracker.getTicks() - baselineTicks);
    const pending = expected - applied;
    if (pending <= 0) return;

    const before = countOccupied(store.getState().city.layers);
    store.getState().applyMalusToCity(pending);
    applied += pending;

    const charactersRemoved = before - countOccupied(store.getState().city.layers);
    if (charactersRemoved <= 0) return;
    send({ type: 'MALUS_APPLIED', payload: { domain, charactersRemoved } });
  };

  return {
    handleAttempt(message): void {
      if (message.payload.choice !== 'proceed') return;
      if (store.getState().timer.status !== 'running') return;
      if (active) return;
      active = true;
      domain = message.payload.domain;
      baselineTicks = tracker.getTicks();
      applied = 0;
      pump();
    },
    handleTick(): void {
      pump();
    },
    dispose(): void {
      unsubscribe();
    },
  };
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

  // Malus across the distraction ticks (M2.T16): the tab tracker (M2.T10)
  // accumulates how long blocked tabs stay open while a session is running, and
  // the wiring routes the overlay's "proceed" choice plus those ticks to the
  // city store.
  const distractionTracker = createTabDistractionTracker({
    eventSource: dependencies.tabEventSource ?? createBrowserTabEventSource(),
    isDistractedUrl: createDistractionPredicate(store),
    now,
  });
  // The tracker's initial tab read is best-effort: a failure must not become an
  // unhandled rejection that kills the service worker (§1.4).
  void distractionTracker.ready.catch((error: unknown) => {
    console.error('[background] tab distraction tracker failed to start', error);
  });
  const malus = createMalusWiring({ store, tracker: distractionTracker });
  disposers.push(() => {
    malus.dispose();
    distractionTracker.dispose();
  });

  // Passive variants: the malus consumes `SITE_BLOCKED_ATTEMPT` and the same
  // 2s `TIMER_TICK` that drives growth; every other variant stays a placeholder
  // until its owning task (M2.T2/M2.T7) lands.
  const handlePassiveMessage = (message: RuntimeMessage): void => {
    if (message.type === 'TIMER_TICK') {
      growthTick.handleTick();
      malus.handleTick();
    } else if (message.type === 'SITE_BLOCKED_ATTEMPT') {
      malus.handleAttempt(message);
    }
  };

  for (const type of MESSAGE_TYPES) {
    disposers.push(onMessage(type, handlePassiveMessage));
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
