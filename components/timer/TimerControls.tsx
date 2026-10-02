import { useAppStore, selectTimerStatus } from '@/store';

/**
 * Start / pause / reset controls (M2.T3). Each button only invokes a store
 * action — the component contains no timer logic and never touches
 * `browser.alarms` (the slice delegates to the injected `AlarmProvider`).
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
        onClick={() => void useAppStore.getState().startTimer()}
        disabled={status === 'running'}
      >
        Start
      </button>
      <button
        type="button"
        onClick={() => void useAppStore.getState().pauseTimer()}
        disabled={status !== 'running'}
      >
        Pause
      </button>
      <button
        type="button"
        onClick={() => void useAppStore.getState().resetTimer()}
        disabled={status === 'idle'}
      >
        Reset
      </button>
    </div>
  );
}
