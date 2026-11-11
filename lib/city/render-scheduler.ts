/**
 * When the city view draws a frame (CR6.T6a, `docs/features-analysis/city-3d.md`
 * §7). Pure: state in, decision out; the clock is the caller's `now` (§1.4).
 *
 * A frame is drawn only for a reason: the visible floors changed, the camera
 * moved, the view was resized, or an ambient frame (rain, flicker) is due. With
 * nothing to show the scheduler asks for no frame callback at all, so an idle
 * city costs nothing.
 */

/** `look` is a change of style (the CRT pass on or off) with the same floors. */
export type DirtyReason = 'floors' | 'camera' | 'resize' | 'look';
export type FrameReason = DirtyReason | 'ambient';

/** The ambient layer never draws more often than this (30 fps). */
export const AMBIENT_INTERVAL_MS = 1000 / 30;

export interface SchedulerState {
  /** Changes seen since the last frame, each once, in the order they came. */
  readonly pending: ReadonlyArray<DirtyReason>;
  /** When the last frame was drawn; null before the first one. */
  readonly lastDrawnAt: number | null;
}

export interface SchedulerInput {
  readonly now: number;
  /** The view is on screen: its tab is open and the document is visible. */
  readonly visible: boolean;
  /** `prefers-reduced-motion`: no ambient layer, only real changes are drawn. */
  readonly reducedMotion: boolean;
  /** Whether an ambient layer exists at all. */
  readonly ambient: boolean;
}

export interface FrameDecision {
  readonly draw: boolean;
  readonly reasons: ReadonlyArray<FrameReason>;
}

export function createSchedulerState(): SchedulerState {
  return { pending: [], lastDrawnAt: null };
}

/** Record a change; the same reason twice before a frame counts once. */
export function invalidate(state: SchedulerState, reason: DirtyReason): SchedulerState {
  if (state.pending.includes(reason)) return state;
  return { ...state, pending: [...state.pending, reason] };
}

function ambientDue(state: SchedulerState, input: SchedulerInput): boolean {
  if (!input.ambient || input.reducedMotion) return false;
  return state.lastDrawnAt === null || input.now - state.lastDrawnAt >= AMBIENT_INTERVAL_MS;
}

/** Whether to draw now, and why. A hidden view draws nothing and keeps its changes pending. */
export function decideFrame(state: SchedulerState, input: SchedulerInput): FrameDecision {
  if (!input.visible) return { draw: false, reasons: [] };
  if (state.pending.length > 0) return { draw: true, reasons: state.pending };
  if (ambientDue(state, input)) return { draw: true, reasons: ['ambient'] };
  return { draw: false, reasons: [] };
}

/** The state after a frame: the pending changes are shown and the clock restarts. */
export function frameDrawn(
  state: SchedulerState,
  decision: FrameDecision,
  now: number,
): SchedulerState {
  if (!decision.draw) return state;
  return { pending: [], lastDrawnAt: now };
}

/** Whether a frame callback should be requested at all (false when idle or hidden). */
export function needsLoop(state: SchedulerState, input: SchedulerInput): boolean {
  if (!input.visible) return false;
  return state.pending.length > 0 || (input.ambient && !input.reducedMotion);
}
