import { useAppStore, selectRemainingSeconds } from '@/store';
import { formatDuration } from '@/utils/format-duration';

/**
 * Presentational countdown (M2.T3). It reads `remainingSeconds` through the
 * store selector and renders it as `hh:mm:ss`; it holds no timer logic of its
 * own (Separation of Concerns, §1.1).
 */
export function TimerDisplay() {
  const remainingSeconds = useAppStore(selectRemainingSeconds);

  return (
    <output className="timer-display" aria-label="Time remaining">
      {formatDuration(remainingSeconds)}
    </output>
  );
}
