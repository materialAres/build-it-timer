import { malusForDistractionTicks } from './malus-escalation';

/** Clamp untrusted time (§1.4): non-finite or negative values count as 0. */
function normalizeMs(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Characters earned from focus alone, for `focusedMs` of focus in a session of
 * `durationMs` worth `total` characters: `floor(focusedMs × total / durationMs)`,
 * capped at `total`. Counted from the session duration, not from the rounded
 * `tickMs`, so a full session gives exactly `total` for any preset. Total: any
 * invalid input degrades to 0.
 */
export function calculateFocusCharacters(
  focusedMs: number,
  durationMs: number,
  total: number,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(
    total,
    Math.floor((normalizeMs(focusedMs) * total) / durationMs),
  );
}

/**
 * Characters earned for `focusedMs` of focus and `distractedMs` on blocked
 * sites in a session of `durationMs` that is worth `total` characters (CR3).
 *
 * Focus is capped at `total`. Distraction is charged on the escalation schedule
 * (`malusForDistractionTicks`, M4.T1; option A of CR6): the whole distraction
 * ticks (`distractedMs × total / durationMs`, the same clock as focus) cost 1
 * character each for the first five, then 2, then 3. The ticks are counted
 * over the whole session, so several short visits escalate like one long
 * stay. The net count never goes below 0, but only the result is clamped:
 * a malus larger than the focus is a debt that later focus pays back before
 * the count rises again. That is deliberate (I013): being a function of
 * the totals, the count charges a distraction the same whatever its moment.
 *
 * Pure and total: no `Date.now()`/`Math.random()`, no hard-coded total, and any
 * invalid input (`NaN`, `±Infinity`, non-positive `durationMs` or `total`)
 * degrades to 0. The result is an integer in `[0, total]`.
 */
export function calculateBuiltCharacters(
  focusedMs: number,
  distractedMs: number,
  durationMs: number,
  total: number,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const focusCharacters = calculateFocusCharacters(focusedMs, durationMs, total);
  const distractionCharacters = malusForDistractionTicks(
    Math.floor((normalizeMs(distractedMs) * total) / durationMs),
  );
  return Math.max(0, Math.floor(focusCharacters - distractionCharacters));
}
