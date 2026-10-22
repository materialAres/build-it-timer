import { createAppStore, attachStoreSync, type AppStore } from '@/store';
import {
  createBrowserAlarmProvider,
  ALARM_MIN_TICK_MS,
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
  type RuntimeMessage,
} from '@/lib/messaging/messages.types';
import { createMutationHandler } from '@/lib/messaging/apply-mutation';
import { isDomainBlocked } from '@/lib/blocking/is-domain-blocked';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { calculatePopulation } from '@/lib/score/calculate-population';
import { tickMsForDurationSeconds } from '@/lib/timer/focus-presets';
import { TIMER_PROGRESS_ALARM, timerAlarmName } from '@/lib/timer/session';
import { advanceProgress } from '@/lib/timer/session-progress';
import type { SessionSummary, TimerState } from '@/store/store.types';
import {
  createBrowserTabEventSource,
  createTabDistractionTracker,
  type TabDistractionTracker,
  type TabEventSource,
} from '@/lib/timer/tab-distraction-tracker';
import type { CityLayers } from '@/components/city/city.types';
import { malusForDistractionTicks } from '@/lib/score/apply-malus';
import { createLogger, type Logger } from '@/utils/logger';

/**
 * The passive `RuntimeMessage` variants defined in M1.T1. The background
 * registers one listener per type, so the wiring is complete before the
 * business logic lands in M2 (M2.T2 timer restore, M2.T7 DNR, M2.T15 growth,
 * M2.T16 malus).
 *
 * The timer *commands* (`TIMER_STARTED`/`TIMER_PAUSED`/`TIMER_RESET`) are not
 * here: they are mutations (M3.T3b) and are registered through `MUTATION_TYPES`,
 * so each type still has exactly one listener.
 */
export const MESSAGE_TYPES = [
  'TIMER_TICK',
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
  /** Centralized logger (M4.T3b). Injectable so tests assert records, not console text. */
  readonly logger?: Logger;
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

/**
 * Growth wiring (M2.T15, extended): the fine-grained character-insertion tick
 * originally arrived only as the typed `TIMER_TICK` message from the active
 * context (popup) — a sampling clock deliberately separate from the 60s
 * `browser.alarms` countdown clock (M1.T5). That made the reward depend on a
 * transient UI context, which is why the city and population froze whenever the
 * popup was closed or the browser lost focus.
 *
 * Accounting is now wall-clock based: `timer.lastAccountedAt` is a persisted
 * checkpoint, and every wake-up (popup tick, progress alarm, worker restart,
 * timer command, session completion) credits the elapsed stretch at once. What
 * one character *costs in time* is still the chosen session's cadence
 * (`lib/timer/focus-presets.ts`), so a longer focus builds the same city more
 * slowly (duration-neutral).
 *
 * The whole session ticks the accumulated focus time covers are handed to
 * `citySlice.growCityByTicks` (M2.T11), which delegates to the session-seeded
 * engine (M2.T12). Deriving the target from the *total* focus time (not the
 * per-tick delta) is what makes catch-up idempotent: any number of missed
 * samples is recovered by the next accounting step, and the leftover fraction
 * of a tick is carried by construction. Time spent while the timer is not
 * `running` is never credited because the checkpoint is cleared on pause/reset/
 * completion, so paused/idle time is not counted as focus.
 *
 * The tracker also accumulates the same running-only elapsed time as
 * `focusedMs`, which is what session completion (M3.T3c) feeds to
 * `calculatePopulation` (M2.T18), on the same session cadence. Sharing the
 * measure is deliberate: the population then always agrees with the city that
 * was actually built, instead of being derived from a second, differently-clocked
 * quantity.
 */
export interface GrowthTickHandle {
  /** Handle one `TIMER_TICK` (the tick handler wired into the message bus). */
  readonly handleTick: () => void;
  /**
   * Credit every millisecond elapsed since the persisted checkpoint. This is
   * the authoritative accounting step: the popup tick, the 60s progress alarm,
   * startup reconciliation, timer commands and session completion all call it,
   * so progress no longer depends on the popup staying open.
   */
  readonly account: () => void;
  /** Running-only focus time accumulated so far, in ms (M3.T3c). */
  readonly getFocusedMs: () => number;
  /** Running-only distraction time accumulated so far, in ms (M2.T18). */
  readonly getDistractedMs: () => number;
  /** Detach the status subscription owned by the tracker. */
  readonly dispose: () => void;
}

export interface GrowthTickDependencies {
  readonly store: AppStore;
  readonly now: () => number;
  /**
   * Whether a blocked site is currently open. Time elapsed while this is true is
   * counted as distraction instead of focus: the city stops growing and the
   * population takes its penalty (M2.T18), so a distracted stretch yields a net
   * decrease rather than a wash.
   */
  readonly isDistracted?: () => boolean;
}

/** Whole growth ticks a timer's accumulated focus time is worth, at its cadence. */
function sessionTicks(timer: TimerState): number {
  return Math.floor(
    timer.focusedMs / tickMsForDurationSeconds(timer.durationSeconds),
  );
}

/**
 * Wall-clock accounting for a running session (M2.T15/M2.T18).
 *
 * The previous design measured elapsed time *between sampling ticks* and reset
 * its baseline to "now" on every transition or service-worker wake-up. That is
 * correct only while the popup is open and emitting `TIMER_TICK`: closing the
 * popup (or switching away from the browser) stopped the clock entirely and
 * froze both the city and the population, while the alarm-backed countdown
 * kept running.
 *
 * Now every wake-up runs {@link account}: it reads the persisted
 * `timer.lastAccountedAt` checkpoint and credits the whole gap at once. Because
 * growth and population are derived from the resulting totals, catch-up is
 * idempotent — any number of lost ticks is recovered by the next opportunity,
 * and the `endsAt` cap prevents crediting time past the session deadline.
 */
function createGrowthTick({
  store,
  now,
  isDistracted = () => false,
}: GrowthTickDependencies): GrowthTickHandle {
  let sessionId = store.getState().timer.sessionId;
  // Growth ticks already reflected in the persisted city. Re-based when the
  // session changes (a new session zeroes `focusedMs`); the persisted focus
  // total is the authority, so a worker restart continues rather than replays.
  let appliedTicks = sessionTicks(store.getState().timer);

  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    if (state.timer.sessionId === sessionId) return;
    sessionId = state.timer.sessionId;
    appliedTicks = sessionTicks(state.timer);
  });

  const account = (): void => {
    const { timer, score } = store.getState();
    const progress = advanceProgress(timer, now(), {
      distracted: isDistracted(),
      tickMs: tickMsForDurationSeconds(timer.durationSeconds),
    });
    if (progress === undefined) return;

    // One write for both accumulators and the checkpoint: `timer` is persisted,
    // so this is the moment the session's progress becomes crash-durable.
    store
      .getState()
      .recordProgress(
        progress.focusedMs,
        progress.distractedMs,
        progress.lastAccountedAt,
      );

    // Cumulative-target growth: the target comes from the *total* focus time,
    // so a gap covering many ticks grows the city in one batch, and a leftover
    // fraction is carried for free by the next accounting step.
    if (progress.targetTicks > appliedTicks) {
      store.getState().growCityByTicks(progress.targetTicks - appliedTicks);
      appliedTicks = progress.targetTicks;
    }

    // Live population (M2.T18): same measures as the city and the malus. The
    // write is skipped while the value is unchanged — `score` is persisted.
    if (progress.population !== score.population) {
      store.getState().setPopulation(progress.population);
    }
  };

  return {
    handleTick: account,
    account,
    getFocusedMs: () => store.getState().timer.focusedMs,
    getDistractedMs: () => store.getState().timer.distractedMs,
    dispose: unsubscribe,
  };
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

export interface SessionCompletionDependencies {
  readonly store: AppStore;
  /** Running-only focus time accumulated by the growth tracker (M2.T15). */
  readonly getFocusedMs: () => number;
  /** Running-only distraction time accumulated by the tab tracker (M2.T16). */
  readonly getDistractedMs: () => number;
  /**
   * Credit the final stretch before the session is closed. The checkpoint is
   * cleared by `completeTimer`, so without this the interval since the last
   * wake-up (up to a minute with the progress alarm, or much longer if the
   * popup was closed) would be lost from the summary.
   */
  readonly account: () => void;
  /** Clock used to stamp `endedAt`; injectable for determinism. */
  readonly now: () => number;
  /** Message sink, injectable so the handler is testable without the bus. */
  readonly send?: (message: RuntimeMessage) => void;
}

export interface SessionCompletion {
  /** Handle one alarm firing; a non-session or stale alarm is ignored. */
  readonly handleAlarm: (name: string) => void;
}
/**
 * Session completion (M3.T3c): the alarm scheduled at the end of the countdown
 * fires, the timer leaves `running` and the session's outcome is recorded.
 *
 * The alarm name is the only thing the firing carries, so it is matched against
 * the *current* session's alarm name: a stale alarm left over from a previous
 * session (or a firing that arrives after a pause/reset) must not complete the
 * session that is running now.
 *
 * The population is derived from the focus time the growth tracker accumulated
 * (M2.T15) rather than from the wall clock, so it agrees with the city that was
 * actually built and excludes paused gaps. The score is whatever the score
 * slice holds: the `distractionRatio` formula is still the roadmap §4 open
 * point, and this task deliberately consumes the value instead of defining it.
 */
export function createSessionCompletion({
  store,
  getFocusedMs,
  getDistractedMs,
  account,
  now,
  send = defaultSend,
}: SessionCompletionDependencies): SessionCompletion {
  return {
    handleAlarm: (name: string): void => {
      const { timer } = store.getState();
      if (timer.status !== 'running') return;
      if (timer.sessionId === null) return;
      if (name !== timerAlarmName(timer.sessionId)) return;

      // Account the last (possibly long, if the popup was closed) stretch
      // before the checkpoint is cleared by `completeTimer`.
      account();

      const population = calculatePopulation(
        getFocusedMs(),
        getDistractedMs(),
        tickMsForDurationSeconds(timer.durationSeconds),
      );
      store.getState().setPopulation(population);
      void store.getState().completeTimer();

      const summary: SessionSummary = {
        sessionId: timer.sessionId,
        score: store.getState().score.level,
        population,
        endedAt: now(),
      };
      store.getState().recordSession(summary);
      send({ type: 'SESSION_ENDED', payload: summary });
    },
  };
}

/**
 * Whether an open tab is a distraction right now: a blocked, canonical domain
 * while a focus session is running. The navigation URL is untrusted, so it is
 * canonicalized with `normalizeEntry` (M2.T21) — the same function the entry
 * path uses — before matching; a URL that cannot be normalized does not match
 * any list (no crash, no erroneous block). Reuses `isDomainBlocked` (M2.T8) so
 * the allowlist-wins precedence (M2.T6) is not reimplemented.
 */
export function createDistractionPredicate(
  store: AppStore,
): (url: string | undefined) => boolean {
  return (url) => {
    if (url === undefined) return false;
    const { timer, blocklist } = store.getState();
    if (timer.status !== 'running') return false;
    const normalized = normalizeEntry(url);
    if (!normalized.ok) return false;
    return isDomainBlocked(blocklist, normalized.value);
  };
}

export interface MalusWiring {
  /** React to the overlay's answer (M2.T8): only `proceed` starts the malus. */
  handleAttempt(
    message: Extract<RuntimeMessage, { type: 'SITE_BLOCKED_ATTEMPT' }>,
  ): void;
  /** Apply the distraction ticks accrued since the previous call. */
  handleTick(): void;
  /** Detach the session subscription owned by the wiring. */
  dispose(): void;
}

export interface MalusWiringDependencies {
  readonly store: AppStore;
  /** Distraction clock source; only the accumulated weighted ms is consumed. */
  readonly tracker: Pick<TabDistractionTracker, 'getAccumulatedMs'>;
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
  let baselineMs = 0;
  let applied = 0;
  let domain = '';
  let sessionId = store.getState().city.sessionId;

  const unsubscribe = store.subscribe(() => {
    const next = store.getState().city.sessionId;
    if (next === sessionId) return;
    sessionId = next;
    active = false;
    baselineMs = 0;
    applied = 0;
  });

  // The remove rule lives in `applyMalus` (M2.T10): this only decides how many
  // ticks are due and hands them to the slice, which never computes. The tick
  // length is the *session* cadence (user-selectable duration), so destruction
  // keeps pace with construction at every preset. The number of characters owed
  // grows with the time spent (M4.T1): `malusForDistractionTicks` escalates the
  // cost per tick, while the first character is still removed at the "proceed"
  // instant itself.
  const pump = (): void => {
    if (!active) return;
    const tickMs = tickMsForDurationSeconds(
      store.getState().timer.durationSeconds,
    );
    const elapsedMs = tracker.getAccumulatedMs() - baselineMs;
    const elapsedTicks = elapsedMs > 0 ? Math.floor(elapsedMs / tickMs) : 0;
    const expected = 1 + malusForDistractionTicks(elapsedTicks);
    const pending = expected - applied;
    if (pending <= 0) return;

    const before = countOccupied(store.getState().city.layers);
    store.getState().applyMalusToCity(pending);
    applied += pending;

    const charactersRemoved =
      before - countOccupied(store.getState().city.layers);
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
      baselineMs = tracker.getAccumulatedMs();
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
  const log = dependencies.logger ?? createLogger('background');

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
      log.error('DNR rule sync failed', error, { boundary: 'dnr' });
    });
  };

  const disposers: Array<() => void> = [];

  // Converge on writes made by other contexts (popup, content script): the
  // background's store rehydrates whenever the persisted key changes (M1.T8).
  disposers.push(attachStoreSync(store));

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
  // unhandled rejection that kills the service worker (§1.4). It is awaited by
  // startup reconciliation before attributing a sleep gap, so an open blocked
  // tab is known when the gap is classified as focus or distraction.
  const trackerReady = distractionTracker.ready.catch((error: unknown) => {
    log.error('tab distraction tracker failed to start', error, {
      boundary: 'tab-tracker',
    });
  });
  const malus = createMalusWiring({ store, tracker: distractionTracker });
  disposers.push(() => {
    malus.dispose();
    distractionTracker.dispose();
  });

  // Growth across the timer ticks (M2.T15): the tracker owns the running/idle
  // baseline used to size each `growCity` delta. It is created after the
  // distraction tracker (M2.T16) so it can consult it: while a blocked site is
  // open the elapsed time is booked as distraction, which pauses the city and
  // applies the population penalty (M2.T18) instead of counting as focus.
  const growthTick = createGrowthTick({
    store,
    now,
    isDistracted: () => distractionTracker.isDistracted(),
  });
  disposers.push(() => {
    growthTick.dispose();
  });

  // Progress heartbeat: the background's own clock, so the city and population
  // keep advancing when the popup is closed (the previous design only advanced
  // on its `TIMER_TICK`). One-shot and self-rescheduling: `browser.alarms`
  // cannot fire faster than the 60s platform minimum anyway, and every firing
  // catches up the whole gap since the persisted checkpoint.
  const armProgressAlarm = (): void => {
    if (store.getState().timer.status !== 'running') return;
    void alarmProvider.schedule(
      TIMER_PROGRESS_ALARM,
      now() + ALARM_MIN_TICK_MS,
    );
  };
  const handleProgressAlarm = (name: string): void => {
    if (name !== TIMER_PROGRESS_ALARM) return;
    growthTick.account();
    malus.handleTick();
    armProgressAlarm();
  };
  disposers.push(alarmProvider.onFire(handleProgressAlarm));

  let lastTimerStatus = store.getState().timer.status;

  /**
   * Start the accounting clock for a running session, in the background's clock
   * domain. A rehydrated running snapshot already carries its persisted
   * checkpoint — that is what makes a sleep/closed-popup gap catch up — so it is
   * only initialized when absent (a fresh start/resume, or an old snapshot).
   */
  const startAccountingClock = (): void => {
    const { timer } = store.getState();
    if (timer.status !== 'running' || Number.isFinite(timer.lastAccountedAt)) {
      return;
    }
    store.getState().recordProgress(timer.focusedMs, timer.distractedMs, now());
  };

  disposers.push(
    store.subscribe(() => {
      const status = store.getState().timer.status;
      if (status === lastTimerStatus) return;
      lastTimerStatus = status;
      if (status === 'running') {
        startAccountingClock();
        armProgressAlarm();
      } else {
        void alarmProvider.clear(TIMER_PROGRESS_ALARM);
      }
    }),
  );
  // Covers the case where the store was already running before the subscription
  // above was installed (a worker that started with a live session).
  startAccountingClock();
  armProgressAlarm();

  // Passive variants: the malus consumes `SITE_BLOCKED_ATTEMPT` and the same
  // sampling `TIMER_TICK` that drives growth; every other variant stays a
  // placeholder until its owning task (M2.T2/M2.T7) lands.
  const handlePassiveMessage = (message: RuntimeMessage): void => {
    if (message.type === 'TIMER_TICK') {
      growthTick.handleTick();
      malus.handleTick();
    } else if (message.type === 'SITE_BLOCKED_ATTEMPT') {
      malus.handleAttempt(message);
    }
  };

  const busLog = log.child('bus');
  for (const type of MESSAGE_TYPES) {
    disposers.push(onMessage(type, handlePassiveMessage, busLog));
  }

  // Cross-context mutations (M1.T10): the popup requests, the background applies.
  // The timer commands (M3.T3b) travel the same path and are applied to the
  // background's own timer slice, so the alarm lives on the background's
  // provider.
  const handleMutation = createMutationHandler(store);
  for (const type of MUTATION_TYPES) {
    disposers.push(
      onMessage(
        type,
        (message) => {
          // Pause/reset clear the checkpoint inside the slice: credit the
          // stretch since the last wake-up before it is lost. `account` is a
          // no-op when the timer is not running, so this is cheap for every
          // mutation.
          if (
            message.type === 'TIMER_PAUSED' ||
            message.type === 'TIMER_RESET'
          ) {
            growthTick.account();
          }
          handleMutation(message);
        },
        busLog,
      ),
    );
  }

  // Any change to the blocklist/allowlist or to the timer status re-evaluates
  // the active rules (M2.T7).
  disposers.push(store.subscribe(syncRules));

  // The alarm provider is wired now so the background owns a single instance for
  // the whole session: the timer slice (M2.T1) schedules the session alarm on it
  // and this subscription receives the firing. The firing is the end of the
  // countdown, so it drives session completion (M3.T3c).
  const completion = createSessionCompletion({
    store,
    getFocusedMs: growthTick.getFocusedMs,
    getDistractedMs: growthTick.getDistractedMs,
    account: growthTick.account,
    now,
  });
  disposers.push(alarmProvider.onFire(completion.handleAlarm));

  // Startup reconciliation (M2.T2): the persisted store may say `running` while
  // the worker was asleep, so the countdown is rebuilt from the still-pending
  // alarm (or the timer is reverted to `paused` if that alarm is gone). The
  // store must be hydrated first, otherwise the persisted timer is not in memory
  // yet and the reconciliation would see the default idle state.
  const ready = (async (): Promise<void> => {
    await store.persist.rehydrate();
    // Seed the open-blocked-tab set before classifying the sleep gap, otherwise
    // a stretch spent on a blocked site could be credited as focus.
    await trackerReady;
    const { timer } = store.getState();
    const restored = await restoreTimer(timer, {
      alarmProvider,
      now,
    });
    if (restored.changed) store.setState({ timer: restored.timer });
    // Ensure the checkpoint exists before crediting a rehydrated running
    // session; it is preserved when the snapshot already had one.
    startAccountingClock();
    // Credit the time the worker was asleep / the popup was closed. The
    // checkpoint survives in storage, so this is the catch-up that used to be
    // lost when the sampling ticks stopped.
    growthTick.account();
    // If the deadline passed while no alarm could fire (machine asleep, alarm
    // coalesced), close the session now instead of leaving it `running` at 0.
    const current = store.getState().timer;
    if (
      current.status === 'running' &&
      current.sessionId !== null &&
      current.endsAt !== null &&
      now() >= current.endsAt
    ) {
      completion.handleAlarm(timerAlarmName(current.sessionId));
    }
    // Awaited so `ready` also means "the dynamic ruleset reflects the restored
    // state": a session that did not survive the restart must not leave the
    // previous session's blocking rules active.
    await rulesSync.sync(store.getState());
  })().catch((error: unknown) => {
    // The startup path is a known boundary (§1.4): a failure here must not
    // become an unhandled rejection that kills the service worker.
    log.error('startup reconciliation failed', error, { boundary: 'startup' });
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

/**
 * Production bootstrap (M4.T3b): `startBackground` is synchronous, so a failure
 * while wiring the worker (a malformed dependency, an unavailable browser API)
 * would otherwise escape the WXT callback. Catch it, log it with context and
 * return `null`: the worker stays alive and the failure is diagnosable instead
 * of silent. Asynchronous startup failures are already contained by `ready`.
 */
export function bootstrapBackground(
  dependencies: BackgroundDependencies = {},
): BackgroundHandle | null {
  const log = dependencies.logger ?? createLogger('background');

  try {
    return startBackground({ ...dependencies, logger: log });
  } catch (error: unknown) {
    log.error('background failed to start', error, { boundary: 'bootstrap' });
    return null;
  }
}

export default defineBackground(() => {
  bootstrapBackground();
});
