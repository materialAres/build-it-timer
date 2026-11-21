/**
 * Pure index and motion math of the Duration Drum (UI.T9, DESIGN.md Duration
 * Drum). The drum is a finite vertical list of presets; every number here is in
 * *rows* (one row = one preset step), so nothing depends on pixels, the DOM or
 * a clock. The component and its gesture hook only translate pointer input into
 * these functions and render their answers.
 */

/** The most a pull past either end may stretch, in rows (a quarter row). */
export const MAX_RUBBER_BAND_ROWS = 0.25;

/** Wheel pixels that make one step: a mouse notch is 100, a trackpad trickles. */
export const WHEEL_STEP_PX = 60;

/** How far a flick carries before snapping, in seconds of the release velocity. */
export const MOMENTUM_SECONDS = 0.12;

/** Height of one row, in rem: three rows plus the fading edges fill 8.5rem. */
export const DRUM_ROW_REM = 2.5;

/** The neighbour numeral's size relative to the selected one (1.35rem / 2.25rem). */
export const NEIGHBOR_SCALE = 0.6;

/** Values are zero-padded to three digits so the column stays aligned. */
export function formatDrumValue(minutes: number): string {
  return String(minutes).padStart(3, '0');
}

/** A valid row index: rounded, inside the list, `0` for a non-finite input. */
export function clampDrumIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  return Math.min(Math.max(Math.round(index), 0), count - 1);
}

/** Move by `delta` rows, stopping at both ends: the list never loops. */
export function stepDrumIndex(
  index: number,
  delta: number,
  count: number,
): number {
  return clampDrumIndex(index + delta, count);
}

/** Row of `value`, or the nearest row for a value the list does not hold. */
export function findDrumIndex(
  values: ReadonlyArray<number>,
  value: number,
): number {
  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  values.forEach((candidate, index) => {
    const gap = Math.abs(candidate - value);
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

/**
 * Opacity of a row `distance` rows from the centre: 1 on the selection, 35% next
 * to it, 12% at the faded edge, then gone. Linear between those stops, so the
 * rows dim continuously while the drum moves.
 */
export function computeRowOpacity(distance: number): number {
  const d = Math.abs(distance);
  if (d >= 3) return 0;
  if (d >= 2) return 0.12 * (3 - d);
  if (d >= 1) return 0.35 - (d - 1) * (0.35 - 0.12);
  return 1 - d * (1 - 0.35);
}

/** Numeral size of a row `distance` rows away, relative to the selected one. */
export function computeRowScale(distance: number): number {
  const d = Math.min(Math.abs(distance), 1);
  return 1 - d * (1 - NEIGHBOR_SCALE);
}

const PHOSPHOR_GREEN = [125, 251, 160] as const;
const SCREEN_WHITE = [230, 230, 230] as const;

/**
 * Text colour of a row `distance` rows from the centre: phosphor green on the
 * selection, screen white from one row away, blended in between so the colour
 * travels with the motion instead of switching.
 */
export function computeRowColor(distance: number): string {
  const t = Math.min(Math.abs(distance), 1);
  const [r, g, b] = PHOSPHOR_GREEN.map((from, i) =>
    Math.round(from + t * ((SCREEN_WHITE[i] ?? from) - from)),
  );
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** Strength of the selected row's glow, 1 on the centre and 0 from half a row. */
export function computeRowGlow(distance: number): number {
  return Math.max(0, 1 - Math.abs(distance) * 2);
}

/**
 * Resist a drag past either end: inside `[0, count - 1]` the offset is
 * untouched, outside it stretches by `over / (1 + 4 * over)` rows, which rises
 * steadily but never passes {@link MAX_RUBBER_BAND_ROWS}.
 */
export function applyRubberBand(offset: number, count: number): number {
  const last = Math.max(count - 1, 0);
  if (offset >= 0 && offset <= last) return offset;
  const over = offset < 0 ? -offset : offset - last;
  const stretch = over / (1 + 4 * over);
  return offset < 0 ? -stretch : last + stretch;
}

/**
 * The row a release settles on: project the offset a little along the release
 * velocity (rows per second), then snap to the nearest row inside the list, so
 * nothing ever rests between two rows.
 */
export function computeSettleIndex(
  offset: number,
  velocityRowsPerSecond: number,
  count: number,
): number {
  return clampDrumIndex(offset + velocityRowsPerSecond * MOMENTUM_SECONDS, count);
}

/** A wheel event's delta in pixels, whatever unit the browser reports it in. */
export function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 40;
  if (deltaMode === 2) return deltaY * 400;
  return deltaY;
}

/**
 * Fold a wheel delta into the running remainder: whole steps come out, the rest
 * is carried to the next event, so a mouse notch is one step and a trackpad's
 * stream of small deltas adds up to steps instead of being lost or multiplied.
 */
export function accumulateWheel(
  remainder: number,
  deltaY: number,
): { readonly steps: number; readonly remainder: number } {
  const total = remainder + deltaY;
  const steps = Math.trunc(total / WHEEL_STEP_PX);
  return { steps, remainder: total - steps * WHEEL_STEP_PX };
}

/**
 * The row a key moves to, or `null` for a key the drum does not handle. Up is
 * longer (the spinbutton convention); Home and End jump to the shortest and
 * longest preset.
 */
export function computeKeyTarget(
  key: string,
  index: number,
  count: number,
): number | null {
  switch (key) {
    case 'ArrowUp':
      return stepDrumIndex(index, 1, count);
    case 'ArrowDown':
      return stepDrumIndex(index, -1, count);
    case 'PageUp':
      return stepDrumIndex(index, 2, count);
    case 'PageDown':
      return stepDrumIndex(index, -2, count);
    case 'Home':
      return 0;
    case 'End':
      return clampDrumIndex(count - 1, count);
    default:
      return null;
  }
}
