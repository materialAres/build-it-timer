/** Clamp untrusted time (§1.4): non-finite or negative values count as 0. */
function normalizeMs(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Characters earned for `focusedMs` of focus and `distractedMs` on blocked
 * sites in a session of `durationMs` that is worth `total` characters (CR3).
 *
 * Characters are counted from the session duration, not from the rounded
 * `tickMs`: a full session gives `durationMs × total / durationMs = total` for
 * any total and any preset, so 100% stays reachable even when `tickMs` rounds.
 * Focus is capped at `total`; every whole distraction character takes one back
 * and the net count never goes below 0.
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
  const focusCharacters = Math.min(
    total,
    Math.floor((normalizeMs(focusedMs) * total) / durationMs),
  );
  const distractionCharacters = Math.floor(
    (normalizeMs(distractedMs) * total) / durationMs,
  );
  return Math.max(0, Math.floor(focusCharacters - distractionCharacters));
}
