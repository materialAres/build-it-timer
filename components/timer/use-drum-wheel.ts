import { useEffect, useRef, type RefObject } from 'react';
import {
  accumulateWheel,
  normalizeWheelDelta,
  stepDrumIndex,
} from '@/lib/timer/duration-drum';

/** At most one wheel step per this interval, so a trackpad cannot spin it. */
const WHEEL_THROTTLE_MS = 90;

interface DrumWheelOptions {
  /** The drum element; the listener is attached here, non-passive. */
  readonly element: HTMLElement | null;
  readonly enabled: boolean;
  readonly count: number;
  readonly indexRef: RefObject<number>;
  readonly moveTo: (index: number) => void;
}

/**
 * Mouse-wheel input of the Duration Drum (UI.T9): one step per notch, small
 * trackpad deltas accumulated into steps and throttled. The listener is
 * non-passive so the wheel does not also scroll the page.
 */
export function useDrumWheel({
  element,
  enabled,
  count,
  indexRef,
  moveTo,
}: DrumWheelOptions): void {
  const state = useRef({ remainder: 0, last: Number.NEGATIVE_INFINITY });

  useEffect(() => {
    if (!element || !enabled) return;
    const handle = (event: WheelEvent): void => {
      event.preventDefault();
      const delta = normalizeWheelDelta(event.deltaY, event.deltaMode);
      const { steps, remainder } = accumulateWheel(state.current.remainder, delta);
      state.current.remainder = remainder;
      const time = globalThis.performance.now();
      if (steps === 0 || time - state.current.last < WHEEL_THROTTLE_MS) return;
      state.current.last = time;
      moveTo(stepDrumIndex(indexRef.current, Math.sign(steps), count));
    };
    element.addEventListener('wheel', handle, { passive: false });
    return () => {
      element.removeEventListener('wheel', handle);
    };
  }, [element, enabled, count, indexRef, moveTo]);
}
