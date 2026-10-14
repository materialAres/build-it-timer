import { i18n } from '#i18n';
import { useAppStore, selectLiveRemainingSeconds } from '@/store';
import { formatDuration } from '@/utils/format-duration';

/**
 * Presentational countdown (M2.T3). It reads the popup-side estimate through the
 * store selector and renders it as `hh:mm:ss`; it holds no timer logic of its
 * own (Separation of Concerns, §1.1).
 *
 * The estimate (`ui.liveRemainingSeconds`, I001) is what makes the display
 * actually count down: the background's `remainingSeconds` is only rewritten at
 * session boundaries, so reading it directly would freeze the display at the
 * session's full duration.
 */
export function TimerDisplay() {
  const remainingSeconds = useAppStore(selectLiveRemainingSeconds);

  return (
    <output
      className="timer-display"
      aria-label={i18n.t('timer.timeRemaining')}
    >
      {formatDuration(remainingSeconds)}
    </output>
  );
}
