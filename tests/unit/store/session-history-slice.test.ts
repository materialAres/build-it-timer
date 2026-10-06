import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  appendSessionSummary,
  createAppStore,
  MAX_SESSION_HISTORY,
  selectSessionHistory,
  selectSessionHistoryState,
} from '@/store';
import type { SessionSummary } from '@/store/store.types';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

/** Build a distinct `SessionSummary` fixture for the given index. */
function summary(index: number): SessionSummary {
  return {
    sessionId: `session-${String(index)}`,
    score: index % 2 === 0 ? 'excellent' : 'good',
    population: index * 5,
    endedAt: 1_700_000_000_000 + index * 1_000,
  };
}

describe('sessionHistorySlice (M2.T19)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: { alarmProvider: new FakeAlarmProvider() },
    });

  it('starts with an empty history', () => {
    const store = createStore();
    const state = store.getState();

    expect(state.sessionHistory.sessions).toEqual([]);
    expect(selectSessionHistory(state)).toEqual([]);
    expect(selectSessionHistoryState(state)).toBe(state.sessionHistory);
  });

  it('records a completed session and exposes it through the selector', () => {
    const store = createStore();
    const ended = summary(1);

    store.getState().recordSession(ended);

    expect(selectSessionHistory(store.getState())).toEqual([ended]);
  });

  it('keeps the most recent session first', () => {
    const store = createStore();
    store.getState().recordSession(summary(1));
    store.getState().recordSession(summary(2));

    expect(
      selectSessionHistory(store.getState()).map((s) => s.sessionId),
    ).toEqual(['session-2', 'session-1']);
  });

  it('keeps only the last 5 sessions, dropping the oldest', () => {
    const store = createStore();
    for (let i = 1; i <= MAX_SESSION_HISTORY + 1; i += 1) {
      store.getState().recordSession(summary(i));
    }

    const sessions = selectSessionHistory(store.getState());
    expect(sessions).toHaveLength(MAX_SESSION_HISTORY);
    expect(sessions.map((s) => s.sessionId)).toEqual([
      'session-6',
      'session-5',
      'session-4',
      'session-3',
      'session-2',
    ]);
  });

  it('replaces an entry when the same session id is recorded twice', () => {
    const store = createStore();
    store.getState().recordSession(summary(1));
    store.getState().recordSession(summary(2));

    store.getState().recordSession({ ...summary(1), score: 'bad' });

    const sessions = selectSessionHistory(store.getState());
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.sessionId).toBe('session-1');
    expect(sessions[0]?.score).toBe('bad');
  });

  it('appendSessionSummary is pure and never mutates the input', () => {
    const input: ReadonlyArray<SessionSummary> = [summary(1)];

    const result = appendSessionSummary(input, summary(2));

    expect(result).not.toBe(input);
    expect(input).toHaveLength(1);
    expect(result.map((s) => s.sessionId)).toEqual(['session-2', 'session-1']);
  });

  it('appendSessionSummary honors a custom max', () => {
    const result = appendSessionSummary(
      [summary(1), summary(2)],
      summary(3),
      2,
    );

    expect(result.map((s) => s.sessionId)).toEqual(['session-3', 'session-1']);
  });

  it('appendSessionSummary is a no-op for a non-positive max', () => {
    const input: ReadonlyArray<SessionSummary> = [summary(1)];

    expect(appendSessionSummary(input, summary(2), 0)).toBe(input);
    expect(appendSessionSummary(input, summary(2), -3)).toBe(input);
  });

  it('appendSessionSummary falls back to the default cap for a non-finite max', () => {
    const input = Array.from({ length: MAX_SESSION_HISTORY + 1 }, (_, i) =>
      summary(i),
    );

    expect(appendSessionSummary(input, summary(99), Number.NaN)).toHaveLength(
      MAX_SESSION_HISTORY,
    );
    expect(
      appendSessionSummary(input, summary(99), Number.POSITIVE_INFINITY),
    ).toHaveLength(MAX_SESSION_HISTORY);
  });
});
