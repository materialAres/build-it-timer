import { i18n } from '#i18n';
import { useState } from 'react';
import { useAppStore } from '@/store';
import type { Preset } from '@/store/store.types';
import { PresetNameForm } from './PresetNameForm';

interface SavedPresetRowProps {
  readonly preset: Preset;
  readonly presets: ReadonlyArray<Preset>;
  readonly editable: boolean;
}

type RowMode = 'view' | 'renaming' | 'confirmingDelete';

/**
 * One saved preset in the edit panel (CR4.T5): rename in place, or delete after
 * an explicit confirmation that says the sites stay blocked (deleting a preset
 * never unblocks anything, CR4.T1 §3.4).
 */
export function SavedPresetRow({
  preset,
  presets,
  editable,
}: SavedPresetRowProps) {
  const [mode, setMode] = useState<RowMode>('view');

  if (mode === 'renaming') {
    return (
      <li className="saved-presets__row">
        <PresetNameForm
          initialName={preset.name}
          presets={presets}
          exceptId={preset.id}
          inputLabel={i18n.t('blocklist.renamePresetLabel', [preset.name])}
          submitLabel={i18n.t('blocklist.save')}
          disabled={!editable}
          onSubmit={(name) => {
            useAppStore.getState().renamePreset(preset.id, name);
            setMode('view');
          }}
          onCancel={() => { setMode('view'); }}
        />
      </li>
    );
  }

  if (mode === 'confirmingDelete') {
    return (
      <li className="saved-presets__row" role="group" aria-label={preset.name}>
        <span className="saved-presets__prompt">
          {i18n.t('blocklist.deletePresetConfirm', [preset.name])}
        </span>
        <button
          type="button"
          className="preset-picker__action"
          disabled={!editable}
          onClick={() => { useAppStore.getState().deletePreset(preset.id); }}
        >
          {i18n.t('blocklist.deletePreset')}
        </button>
        <button
          type="button"
          className="preset-picker__action"
          onClick={() => { setMode('view'); }}
        >
          {i18n.t('blocklist.keepPreset')}
        </button>
      </li>
    );
  }

  return (
    <li className="saved-presets__row">
      <span className="saved-presets__name" title={preset.name}>
        {preset.name}
      </span>
      <button
        type="button"
        className="preset-picker__action"
        disabled={!editable}
        aria-label={i18n.t('blocklist.renamePresetLabel', [preset.name])}
        onClick={() => { setMode('renaming'); }}
      >
        {i18n.t('blocklist.renamePreset')}
      </button>
      <button
        type="button"
        className="preset-picker__action"
        disabled={!editable}
        aria-label={i18n.t('blocklist.deletePresetLabel', [preset.name])}
        onClick={() => { setMode('confirmingDelete'); }}
      >
        {i18n.t('blocklist.deletePreset')}
      </button>
    </li>
  );
}
