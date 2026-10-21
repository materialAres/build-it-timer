import { useEffect } from 'react';
import { sendMessage } from '@/lib/messaging/bus';
import { createTickEmitter } from '@/lib/timer/tick-emitter';
import { useAppStore, selectTimerStatus } from '@/store';

/**
 * Emit the fixed-cadence `TIMER_TICK` while a session is `running` (M3.T3b),
 * tied to the popup's lifetime.
 *
 * **Why the popup owns the tick.** The §1 technical note allows the emitter to
 * live "on the popup/background side only while the context is active". The
 * popup is the context that is active exactly when the user is watching the
 * city, and it is the only one that can be woken this often at all: an MV3
 * service worker is suspended between events and `browser.alarms` cannot tick
 * faster than 60s (M1.T5). The known consequence — the city only grows while
 * the popup is open — is recorded in the changelog; the countdown itself is
 * unaffected, because it is persisted by the background's alarm (M2.T2).
 *
 * This is a *sampling* clock, not the growth cadence: the background converts
 * the elapsed focus time to whole session ticks itself (`lib/timer/
 * focus-presets.ts`), so the interval only bounds how promptly a due character
 * appears.
 *
 * The emitter is a dumb clock: a tick that arrives while the session is not
 * `running` is ignored by the background's growth/malus wiring (M2.T15), so
 * pausing does not require the emitter to be torn down for correctness — only
 * to avoid pointless messages.
 */
export function useTimerTickEmitter(): void {
  const status = useAppStore(selectTimerStatus);

  useEffect(() => {
    if (status !== 'running') return;

    const emitter = createTickEmitter({
      send: () => {
        // The payload carries the last known countdown for observability only:
        // the background measures the elapsed focus time itself (M2.T15) and
        // never trusts this value. The popup-side estimate that would make it
        // accurate (`ui.liveRemainingSeconds`) is deferred — see the changelog.
        const { remainingSeconds } = useAppStore.getState().timer;
        void sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds } });
      },
    });
    emitter.start();

    return () => {
      emitter.stop();
    };
  }, [status]);
}
