export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type ScoreLevel = 'excellent' | 'good' | 'bad';

export interface TimerState {
  readonly status: TimerStatus;
  /**
   * Currently selected session length in seconds. `remainingSeconds` is the live
   * countdown; this is the length a fresh start/reset returns to, and the value
   * that keys the growth/malus cadence (`lib/timer/focus-presets.ts`). Persisted
   * so the choice survives a popup reopen and a service-worker restart.
   */
  readonly durationSeconds: number;
  readonly remainingSeconds: number;
  readonly sessionStartedAt: number | null; // epoch ms, null if idle
  readonly sessionId: string | null;
  /**
   * Absolute epoch ms at which the running countdown reaches zero, or `null`
   * when no countdown is in flight (idle/paused/completed).
   *
   * This is what lets a read-only context (the popup) *estimate* the countdown
   * between reconciliations (I001): `remainingSeconds` alone is only updated by
   * the background at session boundaries, so the UI would otherwise show a
   * frozen value. The background's alarm remains the source of truth — this
   * field is a projection of it, recomputed on every start/resume.
   */
  readonly endsAt: number | null;
  /**
   * Undistracted focus time accumulated by the growth tracker (M2.T15),
   * in ms. Persisted so the accumulator survives a service worker restart
   * mid-session: without it, the restarted tracker would restart from zero
   * and both the live population (M2.T18) and the completion summary
   * (M3.T3c) would undercount the session's real focus time. Reset to 0 on
   * every new session, kept across pause/resume.
   */
  readonly focusedMs: number;
  /**
   * Distraction time accumulated on blocked sites during the session, in ms.
   * Measured by the tab tracker (M2.T16) with the same running-only baseline as
   * `focusedMs`; the malus wiring converts it to ticks at the session cadence.
   * Persisted for the same reason: the
   * population penalty (M2.T18) must survive a service-worker restart mid
   * session. Reset to 0 on every new session.
   */
  readonly distractedMs: number;
  /**
   * Epoch ms up to which `focusedMs`/`distractedMs` already account for time,
   * or `null` when no running stretch is open (idle/paused/completed).
   *
   * Progress is derived from wall-clock time rather than sampled ticks: any
   * background opportunity (a popup tick, the 60s progress alarm, a worker
   * wake-up) credits `now() - lastAccountedAt` and moves this checkpoint
   * forward. Persisting it is what lets the city and population catch up after
   * the popup was closed or the machine was asleep instead of freezing.
   */
  readonly lastAccountedAt: number | null;
}

// derived from remainingSeconds from a formatting function
// (see note on task M2.T3)
export interface FormattedDuration {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

// blocklist
export interface Domain {
  readonly value: string; // normalized domain via tldts, ex. "facebook.com"
}

export interface Tag {
  readonly id: string;
  readonly label: string;
}

export interface BlocklistEntry {
  readonly domain: Domain;
  readonly tagIds: ReadonlyArray<string>;
}

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly domains: ReadonlyArray<Domain>;
  /**
   * Tag applied to every domain when the preset is expanded (M2.T5). It lets a
   * preset's sites be grouped/filtered like any other tagged entry (M3.T2).
   */
  readonly tag: Tag;
}

// history session
export interface SessionSummary {
  readonly sessionId: string;
  readonly score: ScoreLevel;
  readonly population: number;
  readonly endedAt: number; // epoch ms
}
