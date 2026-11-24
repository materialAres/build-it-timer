import { useEffect, useRef } from 'react';

/** The drum has been still this long: a gesture has settled (animation + margin). */
export const DRUM_SETTLE_MS = 260;
/** How long a sent value may wait for the background's answer. */
const ECHO_TIMEOUT_MS = 1_000;

interface DrumCommitOptions {
  /** Minutes the drum shows now. */
  readonly minutes: number;
  /** Minutes the background last confirmed (from the synced store). */
  readonly storeMinutes: number;
  /** A finger or mouse is still on the drum. */
  readonly dragging: boolean;
  readonly send: (minutes: number) => void;
}

/**
 * Send the chosen duration once the drum settles (UI.T9): the visible value
 * changes at once, but `requestSetDuration` goes out only after the drum has
 * been still for a moment, never for each row passed during a flick or a run of
 * key presses. The background stays the single writer; its answer comes back
 * through the sync bridge as `storeMinutes`.
 *
 * `isBusy` tells the caller when a store update must not drag the drum back: a
 * value is waiting to be sent, or was sent and its echo has not arrived yet (an
 * older echo would otherwise undo a newer choice).
 */
export function useDrumCommit({
  minutes,
  storeMinutes,
  dragging,
  send,
}: DrumCommitOptions): { readonly isBusy: () => boolean } {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaiting = useRef<number | null>(null);
  const latest = useRef({ storeMinutes, send });
  latest.current = { storeMinutes, send };

  useEffect(() => {
    if (awaiting.current === storeMinutes) awaiting.current = null;
  }, [storeMinutes]);

  useEffect(() => {
    if (dragging || minutes === latest.current.storeMinutes) return;
    timer.current = globalThis.setTimeout(() => {
      timer.current = null;
      awaiting.current = minutes;
      latest.current.send(minutes);
      globalThis.setTimeout(() => {
        if (awaiting.current === minutes) awaiting.current = null;
      }, ECHO_TIMEOUT_MS);
    }, DRUM_SETTLE_MS);
    return () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [minutes, dragging]);

  return { isBusy: () => timer.current !== null || awaiting.current !== null };
}
