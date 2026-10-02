/**
 * Session helpers for the timer slice (M2.T1): session-id generation and the
 * alarm-name convention shared by the slice and the background (M2.T2).
 */

/**
 * Identifier of a focus session.
 *
 * Format: `<epochMs>-<entropy>`. The leading timestamp makes ids sortable and
 * readable in logs; the entropy makes two sessions started in the same
 * millisecond distinguishable. It is opaque to the rest of the system — nothing
 * parses it back.
 *
 * Pure with respect to its dependencies (see §1.4): both `now` and `random` are
 * parameters, never read from `Date.now()`/`Math.random()` internally, so the
 * same inputs always produce the same id and the caller (the timer slice) can
 * inject deterministic values in tests.
 */
export function generateSessionId(
  now: number,
  random: () => number = Math.random,
): string {
  return `${String(now)}-${random().toString(36).slice(2, 10)}`;
}

/**
 * Name of the one-shot alarm that owns a session's countdown.
 *
 * Namespaced by session id so a stale alarm from a previous session can never be
 * mistaken for the current one: on restart the background (M2.T2) can ask
 * "is there still an alarm for *this* session?" and tell a live countdown apart
 * from a leftover. `AlarmProvider` identifies alarms by name, so the prefix is
 * the only place that convention lives.
 */
export function timerAlarmName(sessionId: string): string {
  return `timer:${sessionId}`;
}
