import { i18n } from '#i18n';
import { useAppStore, selectTimer } from '@/store';
import { FOCUS_PRESETS } from '@/lib/timer/focus-presets';

/**
 * Focus-duration picker (user-selectable timer duration).
 *
 * Presentational only: it maps the centralized preset table
 * (`lib/timer/focus-presets.ts`) to buttons and invokes a store action — no
 * duration logic lives here (Separation of Concerns, §1.1). A new preset appears
 * here for free because the options are data, not a hand-written list.
 *
 * The popup's store is read-only (M1.T9), so the click only *requests* the
 * change; the background (the owner) validates it and the UI converges through
 * the M1.T8 sync bridge. The buttons are disabled while a session is running or
 * paused, when the length cannot change without desyncing the alarm.
 */
const DURATION_PICKER_STYLES = `
  .duration-picker {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem;
  }
  .duration-picker button[aria-pressed='true'] {
    border-color: #7dfba0;
    color: #7dfba0;
    text-shadow: 0 0 4px currentColor;
  }
`;

export function DurationPicker() {
  const { status, durationSeconds } = useAppStore(selectTimer);
  const locked = status === 'running' || status === 'paused';

  return (
    <div
      className="duration-picker"
      role="group"
      aria-label={i18n.t('timer.durationLabel')}
    >
      <style>{DURATION_PICKER_STYLES}</style>
      {FOCUS_PRESETS.map((preset) => (
        <button
          key={preset.minutes}
          type="button"
          aria-pressed={preset.durationSeconds === durationSeconds}
          disabled={locked}
          onClick={() => {
            useAppStore.getState().requestSetDuration(preset.durationSeconds);
          }}
        >
          {i18n.t('timer.durationOption', [String(preset.minutes)])}
        </button>
      ))}
    </div>
  );
}
