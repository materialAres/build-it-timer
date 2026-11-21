import {
  advanceMotion,
  crackLevel,
  createMotionState,
  displayCount,
  dropOffset,
  glitchLevel,
  glitchShift,
  isMoving,
  pruneMotion,
  type MotionEntry,
  type MotionState,
} from '@/lib/city/floor-motion';
import type { SceneFrame } from '@/lib/city/plan/scene-data';
import type { SlotLook, SlotWriter } from './floor-slots';

export interface FloorAnimationsInput {
  readonly slots: SlotWriter;
  /** How many floors the meshes draw (removed floors stay while they glitch out). */
  readonly setVisibleCount: (count: number) => void;
}

export interface FloorAnimations {
  /** The frame now shown: a new floor drops in, a removed one glitches out. */
  setFrame(frame: SceneFrame, now: number): void;
  /** Advance to `now` and rewrite the slots that move; `ambientTick` also steps the damaged flicker (30 fps cap). */
  update(now: number, ambientTick: boolean): void;
  /** A floor animation is still running. */
  readonly active: boolean;
  /** Animations on or off; off finishes any running one at once (reduced motion). */
  setEnabled(enabled: boolean): void;
  /** The damaged top floor flickers; off keeps it steady red. */
  setFlicker(enabled: boolean): void;
}

const ageOf = (entries: ReadonlyArray<MotionEntry>, slot: number, now: number): number | null => {
  const entry = entries.find((e) => e.slot === slot);
  return entry === undefined ? null : now - entry.start;
};

const slotsOf = (state: MotionState): number[] => [...state.drops, ...state.glitches].map((e) => e.slot);

/** How one slot looks at `now`: dropping, glitching, the partly paid floor (flickering when damaged), or at rest. */
function lookFor(state: MotionState, frame: SceneFrame | null, flicker: boolean, slot: number, now: number): SlotLook {
  const partial = frame?.partial?.index === slot ? frame.partial : undefined;
  const dropAge = ageOf(state.drops, slot, now);
  const glitchAge = ageOf(state.glitches, slot, now);
  if (glitchAge !== null) {
    return { glitch: glitchLevel(glitchAge), shift: [glitchShift(slot, glitchAge), 0, 0] };
  }
  const glow = partial?.damaged === true && flicker ? crackLevel(now) : 1;
  return { partial, glow, shift: [0, dropAge === null ? 0 : dropOffset(dropAge), 0] };
}

/**
 * The floor animations of CR6.T7: a new floor drops in, a removed floor
 * glitches out in red, the damaged top floor flickers. Timing lives in
 * `lib/city/floor-motion.ts`; this only writes slots. Everything ends at rest:
 * a finished slot is redrawn from its static data, and the visible count falls
 * back to the frame's.
 */
export function createFloorAnimations({ slots, setVisibleCount }: FloorAnimationsInput): FloorAnimations {
  let state: MotionState = createMotionState();
  let frame: SceneFrame | null = null;
  let enabled = true;
  let flicker = true;
  let lastNow = 0;
  /** Slots last drawn off their resting data; restored once nothing animates them any more. */
  let moved = new Set<number>();

  const redraw = (slotsToDraw: Iterable<number>, now: number): void => {
    for (const slot of new Set(slotsToDraw)) slots.draw(slot, lookFor(state, frame, flicker, slot, now));
  };
  const finish = (): void => {
    state = { ...state, drops: [], glitches: [] };
    redraw(moved, lastNow);
    moved = new Set();
    setVisibleCount(displayCount(state));
  };

  return {
    setFrame(next, now): void {
      frame = next;
      lastNow = now;
      state = enabled ? advanceMotion(state, next.instanceCount, now) : { ...state, target: next.instanceCount };
    },
    update(now, ambientTick): void {
      lastNow = now;
      state = pruneMotion(state, now);
      const active = slotsOf(state);
      const partial = frame?.partial;
      const flickering = ambientTick && partial?.damaged === true && flicker ? [partial.index] : [];
      if (moved.size === 0 && active.length === 0 && flickering.length === 0) return;
      redraw([...moved, ...active, ...flickering], now);
      moved = new Set(active);
      setVisibleCount(displayCount(state));
    },
    get active(): boolean {
      return enabled && isMoving(state);
    },
    setEnabled(value): void {
      enabled = value;
      if (!value) finish();
    },
    setFlicker(value): void {
      flicker = value;
      if (frame?.partial) redraw([frame.partial.index], lastNow);
    },
  };
}
