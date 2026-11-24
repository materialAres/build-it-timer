import { i18n } from '#i18n';
import { useState } from 'react';
import { selectBlocklist, useAppStore } from '@/store';
import type { Preset } from '@/store/store.types';
import { PresetNameForm } from './PresetNameForm';
import { SavedPresetRow } from './SavedPresetRow';

interface SavedPresetControlsProps {
  readonly presets: ReadonlyArray<Preset>;
  readonly userPresets: ReadonlyArray<Preset>;
  readonly editable: boolean;
}

type Panel = 'closed' | 'saving' | 'editing';

/**
 * Save / edit controls under the preset row (CR4.T5, UI.T3). Closed by default
 * so the tab stays short: "Save list as preset" opens the name field, "Edit
 * saved presets" (only when there are some) opens rename/delete per preset.
 */
export function SavedPresetControls({
  presets,
  userPresets,
  editable,
}: SavedPresetControlsProps) {
  const [panel, setPanel] = useState<Panel>('closed');
  const hasSites = useAppStore(selectBlocklist).length > 0;
  const toggle = (next: Panel): void => {
    setPanel(panel === next ? 'closed' : next);
  };

  return (
    <>
      <div className="preset-picker__actions">
        <button
          type="button"
          className="preset-picker__action"
          disabled={!editable || !hasSites}
          aria-expanded={panel === 'saving'}
          onClick={() => { toggle('saving'); }}
        >
          {i18n.t('blocklist.savePreset')}
        </button>
        {userPresets.length > 0 ? (
          <button
            type="button"
            className="preset-picker__action"
            aria-expanded={panel === 'editing'}
            onClick={() => { toggle('editing'); }}
          >
            {i18n.t('blocklist.editSavedPresets')}
          </button>
        ) : null}
      </div>
      {panel === 'saving' && hasSites ? (
        <PresetNameForm
          presets={presets}
          inputLabel={i18n.t('blocklist.presetName')}
          submitLabel={i18n.t('blocklist.save')}
          note={i18n.t('blocklist.savePresetNote')}
          disabled={!editable}
          onSubmit={(name) => {
            useAppStore.getState().savePreset(name);
            setPanel('closed');
          }}
          onCancel={() => { setPanel('closed'); }}
        />
      ) : null}
      {panel === 'editing' && userPresets.length > 0 ? (
        <ul
          className="saved-presets"
          aria-label={i18n.t('blocklist.savedPresets')}
        >
          {userPresets.map((preset) => (
            <SavedPresetRow
              key={preset.id}
              preset={preset}
              presets={presets}
              editable={editable}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
}
