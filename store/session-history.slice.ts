import type { StateCreator } from 'zustand';
import type { SessionSummary } from './store.types';
import type { AppState } from '.';

/**
 * How many completed sessions the history keeps (roadmap M2.T19 / §1.3). Once a
 * sixth session ends, the oldest entry is dropped.
 */
export const MAX_SESSION_HISTORY = 5;

export interface SessionHistoryState {
  readonly sessions: ReadonlyArray<SessionSummary>;
}

export interface SessionHistorySlice {
  readonly sessionHistory: SessionHistoryState;
  /**
   * Record a completed session (M1.T1 `SessionSummary`) at the front of the
   * last-`MAX_SESSION_HISTORY` history. The value is provided by the caller
   * (`SESSION_ENDED`); the slice only stores it, never computes it.
   */
  recordSession(summary: SessionSummary): void;
}

const initialSessionHistoryState: SessionHistoryState = { sessions: [] };

/**
 * Insert a completed session at the front (newest first) and keep only the last
 * `max` entries. Pure: returns a new array and never mutates the input.
 *
 * Recording the same `sessionId` twice replaces the existing entry instead of
 * duplicating it, so a re-emitted `SESSION_ENDED` (M1.T1) cannot grow the
 * history. A non-positive `max` is a no-op that returns the *same* reference,
 * so a caller can skip persisting it (same identity pattern as M1.T10/M2.T10).
 * A non-finite `max` falls back to the default cap rather than leaking into
 * `slice` (defensive at the untrusted boundary, §1.4).
 */
export function appendSessionSummary(
  sessions: ReadonlyArray<SessionSummary>,
  summary: SessionSummary,
  max: number = MAX_SESSION_HISTORY,
): ReadonlyArray<SessionSummary> {
  const limit = Math.max(
    0,
    Math.floor(Number.isFinite(max) ? max : MAX_SESSION_HISTORY),
  );
  if (limit === 0) return sessions;

  const withoutDuplicate = sessions.filter(
    (entry) => entry.sessionId !== summary.sessionId,
  );
  return [summary, ...withoutDuplicate].slice(0, limit);
}

/**
 * History of the last 5 completed sessions (roadmap M2.T19 / §1.3). The slice
 * is a thin store layer: insertion/cap/dedup live in the pure
 * `appendSessionSummary` helper above, so they stay testable in isolation and
 * the slice computes nothing (principle S/D). The history is part of the
 * persisted state (`store/index.ts`), so a focus-session history survives a
 * service-worker restart.
 */
export const createSessionHistorySlice: StateCreator<
  AppState,
  [],
  [],
  SessionHistorySlice
> = (set, get) => ({
  sessionHistory: initialSessionHistoryState,

  recordSession(summary: SessionSummary): void {
    const { sessionHistory } = get();
    const sessions = appendSessionSummary(sessionHistory.sessions, summary);
    // Same reference means a no-op (non-positive cap): skip the write so it is
    // neither persisted nor re-rendered.
    if (sessions === sessionHistory.sessions) return;
    set({ sessionHistory: { sessions } });
  },
});

export const selectSessionHistoryState = (
  state: SessionHistorySlice,
): SessionHistoryState => state.sessionHistory;

export const selectSessionHistory = (
  state: SessionHistorySlice,
): ReadonlyArray<SessionSummary> => state.sessionHistory.sessions;
