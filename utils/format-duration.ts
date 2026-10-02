/**
 * Format a duration in seconds as `hh:mm:ss` (M2.T3).
 *
 * Pure and dependency-free so it can be tested in isolation and reused by any
 * component that needs to display a countdown. `remainingSeconds` is the single
 * source of truth in the store; this is the only place that turns it into the
 * hour/minute/second representation the UI shows.
 *
 * The function is total: any non-finite input (`NaN`, `±Infinity`, and the
 * `null`/`undefined` that can slip in from untyped callers) renders as
 * `00:00:00` instead of leaking `NaN:NaN:NaN` into the UI. Fractional seconds
 * are truncated and negative values are clamped to zero, so a transient
 * out-of-range value can never render as `-1:-1:-1`.
 */
export function formatDuration(totalSeconds: number): string {
  // `Number.isFinite` rejects NaN/±Infinity (and does not coerce strings), which
  // `Math.max`/`Math.floor` alone would let through as NaN.
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map(pad2).join(':');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
