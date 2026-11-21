import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { animate, type AnimationPlaybackControls, type MotionValue } from 'framer-motion';
import { useDrumWheel } from './use-drum-wheel';
import {
  DRUM_ROW_REM,
  applyRubberBand,
  clampDrumIndex,
  computeKeyTarget,
  computeSettleIndex,
} from '@/lib/timer/duration-drum';

/** One step: 180ms with a fast ease-out (DESIGN.md Duration Drum, Motion). */
const STEP_TRANSITION = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const;
/** A pointer must travel this far before it stops being a click. */
const DRAG_THRESHOLD_PX = 4;
/** Pointer samples closer than this are too noisy to give a velocity. */
const MIN_SAMPLE_MS = 8;
/** A flick is capped so it carries at most about three rows. */
const MAX_VELOCITY_ROWS_PER_SECOND = 25;

interface DrumGestureOptions {
  readonly count: number;
  /** Row offset the drum is drawn at, in rows; the hook animates it. */
  readonly offset: MotionValue<number>;
  /** Whether input is accepted; `false` while a session is in progress. */
  readonly enabled: boolean;
  readonly reducedMotion: boolean;
  /** The row the drum is settling on (called once per move). */
  readonly onIndexChange: (index: number) => void;
  readonly onDraggingChange: (dragging: boolean) => void;
  /** The wheel listener is attached here, non-passive. */
  readonly element: HTMLElement | null;
}

interface Drag {
  readonly pointerId: number;
  readonly startY: number;
  readonly startOffset: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

/** The hook's own clock, so gesture timing is not tied to event stamps. */
const now = (): number => globalThis.performance.now();

/** Pointer capture keeps a drag alive outside the drum; not every engine has it. */
function capturePointer(target: HTMLElement, id: number, capture: boolean): void {
  if (capture && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(id);
  } else if (!capture && typeof target.releasePointerCapture === 'function') {
    target.releasePointerCapture(id);
  }
}

/** Pixels in one row, from the live root font size (rem-based layout). */
function rowPixels(): number {
  const root = parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize);
  return DRUM_ROW_REM * (Number.isFinite(root) && root > 0 ? root : 16);
}

/**
 * Pointer, wheel and keyboard input of the Duration Drum (UI.T9). All the maths
 * is in `lib/timer/duration-drum.ts`; this hook only converts events to rows,
 * drives the offset motion value and reports where the drum settles.
 */
export function useDrumGesture({
  count,
  offset,
  enabled,
  reducedMotion,
  onIndexChange,
  onDraggingChange,
  element,
}: DrumGestureOptions) {
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<Drag | null>(null);
  const draggedRecently = useRef(false);
  const indexRef = useRef(0);

  const moveTo = useCallback(
    (target: number): void => {
      const index = clampDrumIndex(target, count);
      controls.current?.stop();
      if (reducedMotion) offset.set(index);
      else controls.current = animate(offset, index, STEP_TRANSITION);
      indexRef.current = index;
      onIndexChange(index);
    },
    [count, offset, reducedMotion, onIndexChange],
  );

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (!enabled || event.button > 0) return;
    controls.current?.stop();
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: offset.get(),
      lastY: event.clientY,
      lastTime: now(),
      velocity: 0,
      moved: false,
    };
    capturePointer(event.currentTarget, event.pointerId, true);
    onDraggingChange(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    const rowPx = rowPixels();
    if (Math.abs(event.clientY - current.startY) > DRAG_THRESHOLD_PX) {
      current.moved = true;
    }
    const raw = current.startOffset + (current.startY - event.clientY) / rowPx;
    offset.set(reducedMotion ? clampDrumIndex(raw, count) : applyRubberBand(raw, count));
    const time = now();
    const dtMs = time - current.lastTime;
    if (dtMs >= MIN_SAMPLE_MS) {
      const velocity = (current.lastY - event.clientY) / rowPx / (dtMs / 1000);
      current.velocity = Math.max(
        -MAX_VELOCITY_ROWS_PER_SECOND,
        Math.min(MAX_VELOCITY_ROWS_PER_SECOND, velocity),
      );
      current.lastY = event.clientY;
      current.lastTime = time;
    }
  };

  const finishDrag = (event: PointerEvent<HTMLElement>): void => {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    draggedRecently.current = current.moved;
    // The click fires right after pointerup; forget the drag once it passed.
    globalThis.setTimeout(() => {
      draggedRecently.current = false;
    }, 0);
    capturePointer(event.currentTarget, event.pointerId, false);
    moveTo(
      reducedMotion
        ? offset.get()
        : computeSettleIndex(offset.get(), current.velocity, count),
    );
    onDraggingChange(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = enabled
      ? computeKeyTarget(event.key, indexRef.current, count)
      : null;
    if (target === null) return;
    event.preventDefault();
    moveTo(target);
  };

  /** Select a row (a click on a neighbour); a drag's trailing click is ignored. */
  const selectRow = (index: number): void => {
    if (!enabled || draggedRecently.current) return;
    moveTo(index);
  };

  useDrumWheel({ element, enabled, count, indexRef, moveTo });

  useEffect(
    () => () => {
      controls.current?.stop();
    },
    [],
  );

  return {
    /** The row the drum shows when the hook did not move it itself. */
    setCurrentIndex: (index: number): void => {
      indexRef.current = index;
    },
    moveTo,
    selectRow,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onKeyDown,
    },
  };
}
