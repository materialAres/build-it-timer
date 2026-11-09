import { i18n } from '#i18n';
import { PRESETS } from '@/lib/blocking/presets';
import { selectBlocklistEditable, useAppStore } from '@/store';

/**
 * The picker's own stylesheet, consistent with the CRT/monospace look used by
 * the rest of the popup (M2.T14/M2.T17/M2.T18).
 */
const PRESET_PICKER_STYLES = `
  .preset-picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .preset-picker__label {
    margin-right: 0.2rem;
    color: #e6e6e6;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .preset-picker__button {
    padding: 0.3rem 0.7rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: #4dabf7;
    cursor: pointer;
    letter-spacing: 0.06em;
    text-shadow: 0 0 4px currentColor;
  }
  .preset-picker__button:hover {
    background: rgba(77, 171, 247, 0.15);
  }
`;

/**
 * Preset selection UI (M3.T1): lists the ready-made presets (M2.T5) and applies
 * one to the blocklist with a **single** store action. The component is
 * presentational — it holds no expansion logic and never normalizes or expands
 * domains itself; it only invokes `applyPreset`, which owns the single-update
 * expansion (reusing the M2.T4/M2.T20 logic) and forwards one mutation to the
 * background (M1.T10).
 */
// A visible label (UI.T1): the pills sit under the add field, so the row has to
// say what it is instead of relying on an invisible group name.
const PRESET_PICKER_LABEL_ID = 'preset-picker-label';

export function PresetPicker() {
  const editable = useAppStore(selectBlocklistEditable);

  return (
    <div
      className="preset-picker"
      role="group"
      aria-labelledby={PRESET_PICKER_LABEL_ID}
    >
      <style>{PRESET_PICKER_STYLES}</style>
      <span id={PRESET_PICKER_LABEL_ID} className="preset-picker__label">
        {i18n.t('blocklist.presets')}
      </span>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="preset-picker__button"
          data-preset-id={preset.id}
          disabled={!editable}
          aria-label={i18n.t('blocklist.applyPreset', [preset.name])}
          onClick={() => {
            useAppStore.getState().applyPreset(preset.id);
          }}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}
