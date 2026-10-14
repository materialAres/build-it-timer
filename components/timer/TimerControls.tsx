import { i18n } from '#i18n';
import { useAppStore, selectTimerStatus } from '@/store';

/**
 * Start / pause / reset controls (M2.T3). Each button only invokes a store
 * action — the component contains no timer logic and never touches
 * `browser.alarms` (the slice delegates to the injected `AlarmProvider`).
 *
 * The actions invoked are the `request*` ones (M3.T3b): the popup's store is
 * read-only (M1.T9), so the transition is requested from the background — the
 * timer's owner — and the UI converges on the applied state through the M1.T8
 * sync bridge. The disabled state therefore reflects the *synced* status, which
 * is the authoritative one.
 *
 * The buttons are disabled according to the current status so the UI cannot
 * request a transition the slice would treat as a no-op (e.g. pausing an idle
 * timer).
 */
export function TimerControls() {
  const status = useAppStore(selectTimerStatus);

  return (
    <div className="timer-controls">
      <button
        type="button"
        onClick={() => {
          useAppStore.getState().requestStartTimer();
        }}
        disabled={status === 'running'}
      >
        {i18n.t('timer.start')}
      </button>
      <button
        type="button"
        onClick={() => {
          useAppStore.getState().requestPauseTimer();
        }}
        disabled={status !== 'running'}
      >
        {i18n.t('timer.pause')}
      </button>
      <button
        type="button"
        onClick={() => {
          useAppStore.getState().requestResetTimer();
        }}
        disabled={status === 'idle'}
      >
        {i18n.t('timer.reset')}
      </button>
    </div>
  );
}
