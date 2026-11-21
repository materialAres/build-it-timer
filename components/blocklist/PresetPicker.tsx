import { i18n } from '#i18n';
import { useMemo } from 'react';
import { PRESETS } from '@/lib/blocking/presets';
import {
  selectBlocklistAddAllowed,
  selectBlocklistEditable,
  selectUserPresets,
  useAppStore,
} from '@/store';
import { PresetToggle } from './PresetToggle';
import { SavedPresetControls } from './SavedPresetControls';
import { PRESET_PICKER_STYLES } from './preset-picker.styles';

// A visible label (UI.T1): the pills sit under the add field, so the row has to
// say what it is instead of relying on an invisible group name.
const PRESET_PICKER_LABEL_ID = 'preset-picker-label';

/**
 * Preset row of the Blocklist tab (M3.T1, toggles and saved presets CR4.T5):
 * built-in presets and the user's saved ones side by side, each a toggle over
 * the single list, followed by the save / edit controls. Presentational: the
 * store actions own every change and the background applies it (M1.T10).
 */
export function PresetPicker() {
  const editable = useAppStore(selectBlocklistEditable);
  const addAllowed = useAppStore(selectBlocklistAddAllowed);
  const userPresets = useAppStore(selectUserPresets);
  const presets = useMemo(() => [...PRESETS, ...userPresets], [userPresets]);

  return (
    <div className="preset-picker">
      <style>{PRESET_PICKER_STYLES}</style>
      <div
        className="preset-picker__row"
        role="group"
        aria-labelledby={PRESET_PICKER_LABEL_ID}
      >
        <span id={PRESET_PICKER_LABEL_ID} className="preset-picker__label">
          {i18n.t('blocklist.presets')}
        </span>
        {presets.map((preset) => (
          <PresetToggle
            key={preset.id}
            preset={preset}
            editable={editable}
            addAllowed={addAllowed}
          />
        ))}
      </div>
      <SavedPresetControls
        presets={presets}
        userPresets={userPresets}
        editable={editable}
      />
    </div>
  );
}
