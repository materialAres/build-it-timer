/**
 * The timeline of the floor animations (CR6.T7), pure: state and a time in,
 * state and levels out. A new floor drops in, a removed floor glitches out in
 * red, and a damaged top floor flickers. Every animation ends in the rest state
 * (`isMoving` false, `displayCount` equal to the target), so a burst of
 * changes never leaves a floor half-drawn.
 */

export const DROP_MS = 360;
export const DROP_HEIGHT = 2.4;
export const GLITCH_MS = 320;
const GLITCH_STEP_MS = 40;
/** Floors animated per change; in a bigger burst the older ones just appear or vanish. */
export const MAX_ANIMATED_FLOORS = 12;
export const CRACK_PERIOD_MS = 1700;

/** Red intensity per 40 ms step of a glitch; 0 is a blink-out. */
const GLITCH_PATTERN: ReadonlyArray<number> = [1, 0.25, 0.9, 0, 0.6, 0.15, 0.4, 0];

export interface MotionEntry {
  readonly slot: number;
  readonly start: number;
}

export interface MotionState {
  /** Floors shown when last told; null before the first frame (no animation on first paint). */
  readonly target: number | null;
  readonly drops: ReadonlyArray<MotionEntry>;
  readonly glitches: ReadonlyArray<MotionEntry>;
}

export function createMotionState(): MotionState {
  return { target: null, drops: [], glitches: [] };
}

const entries = (from: number, to: number, start: number): MotionEntry[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, i) => ({ slot: from + i, start }));

/** Drop the entries that have ended. */
export function pruneMotion(state: MotionState, now: number): MotionState {
  return {
    ...state,
    drops: state.drops.filter((e) => now - e.start < DROP_MS),
    glitches: state.glitches.filter((e) => now - e.start < GLITCH_MS),
  };
}

/** The state after the shown floor count changed to `target`. */
export function advanceMotion(state: MotionState, target: number, now: number): MotionState {
  const previous = state.target;
  if (previous === null || previous === target) return pruneMotion({ ...state, target }, now);
  if (target > previous) {
    const first = Math.max(previous, target - MAX_ANIMATED_FLOORS);
    return pruneMotion(
      {
        target,
        drops: [...state.drops, ...entries(first, target, now)],
        glitches: state.glitches.filter((e) => e.slot >= target),
      },
      now,
    );
  }
  const first = Math.max(target, previous - MAX_ANIMATED_FLOORS);
  return pruneMotion(
    {
      target,
      drops: state.drops.filter((e) => e.slot < target),
      glitches: [...state.glitches, ...entries(first, previous, now)],
    },
    now,
  );
}

/** Floors to draw: the target plus any removed floors still glitching out. */
export function displayCount(state: MotionState): number {
  return Math.max(state.target ?? 0, ...state.glitches.map((e) => e.slot + 1));
}

export function isMoving(state: MotionState): boolean {
  return state.drops.length > 0 || state.glitches.length > 0;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** How far above its place a new floor is, `age` ms after it was added. */
export function dropOffset(age: number): number {
  const t = Math.min(Math.max(age / DROP_MS, 0), 1);
  return DROP_HEIGHT * (1 - easeOutCubic(t));
}

function glitchStep(age: number): number {
  return Math.floor(Math.max(age, 0) / GLITCH_STEP_MS);
}

/** Red intensity of a glitching floor; 0 at a blink-out and once it is over. */
export function glitchLevel(age: number): number {
  if (age >= GLITCH_MS) return 0;
  return GLITCH_PATTERN[glitchStep(age) % GLITCH_PATTERN.length] ?? 0;
}

/** A small sideways shake of a glitching floor, in world units. */
export function glitchShift(slot: number, age: number): number {
  return (((glitchStep(age) * 7 + slot * 3) % 5) - 2) * 0.03;
}

/** Brightness of a damaged top floor's edges: a steady dim glow with sharp dropouts. */
export function crackLevel(ms: number): number {
  const phase = (((ms % CRACK_PERIOD_MS) + CRACK_PERIOD_MS) % CRACK_PERIOD_MS) / CRACK_PERIOD_MS;
  if (phase < 0.06) return 0.15;
  if (phase < 0.12) return 1;
  if (phase < 0.18) return 0.3;
  return 0.75;
}
