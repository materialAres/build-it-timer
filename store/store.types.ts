export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type ScoreLevel = 'excellent' | 'good' | 'bad';

export interface TimerState {
  readonly status: TimerStatus;
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
