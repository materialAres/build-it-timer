export type TimerStatus = 'idle' | 'running' | 'paused';

export type ScoreLevel = 'excellent' | 'good' | 'bad';

export interface TimerState {
  readonly status: TimerStatus;
  readonly remainingSeconds: number;
  readonly sessionStartedAt: number | null; // epoch ms, null if idle
  readonly sessionId: string | null;
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
