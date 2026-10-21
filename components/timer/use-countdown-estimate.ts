import { useEffect } from 'react';
import { estimateRemainingSeconds } from '@/lib/timer/countdown';
import { useAppStore, selectTimer } from '@/store';

/** Cadence of the popup-side estimate; the alarm reconciles it at the end. */
export const COUNTDOWN_TICK_MS = 1_000;

/**
 * Drive the popup-side countdown estimate (I001).
 *
 * The background owns the session and its alarm, but it never rewrites
 * `remainingSeconds` while the countdown runs (the alarm is one-shot and cannot
 * tick faster than 60s, M1.T5). The popup therefore projects the value from the
 * session's absolute end time once per second and publishes it through
 * `ui.liveRemainingSeconds`, which `TimerDisplay` reads.
 *
 * The estimate is recomputed from the *store's* `endsAt` on every tick, so it
 * self-corrects whenever the background's state arrives through the M1.T8 sync
 * bridge (a pause, a resume, a restart): there is no local drift to reconcile.
 * The interval only runs while the session is `running`, so a paused or
 * finished session costs nothing.
 */
export function useCountdownEstimate(): void {
  const timer = useAppStore(selectTimer);
  const { status, endsAt, remainingSeconds } = timer;

  useEffect(() => {
    const publish = (): void => {
      const current = useAppStore.getState().timer;
      useAppStore
        .getState()
        .setLiveRemainingSeconds(estimateRemainingSeconds(current, Date.now()));
    };

    // Publish immediately so the display is correct before the first interval
    // fires (e.g. right after a resume, a popup reopen, or a duration change).
    publish();
    if (status !== 'running' || endsAt === null) return;

    const handle = globalThis.setInterval(publish, COUNTDOWN_TICK_MS);
    return () => {
      globalThis.clearInterval(handle);
    };
    // `remainingSeconds` is a dependency so an idle/paused change to the
    // persisted value — most notably a new duration choice — is reflected at
    // once. While running it stays constant (the background only rewrites it at
    // a pause), so the interval is not needlessly recreated each second.
  }, [status, endsAt, remainingSeconds]);
}
