import { useState } from 'react';
import { i18n } from '#i18n';
import type { SoundPreferencesPatch } from '@/lib/sound/sound-preferences';
import { SOUND_THEMES } from '@/lib/sound/sound-themes';
import type { SoundThemeId } from '@/lib/sound/sound.types';
import {
  selectSoundEnabled,
  selectSoundThemeId,
  selectSoundVolume,
  useAppStore,
} from '@/store';
import { useSoundPreview } from './use-sound-preview';
import { SOUND_SETTINGS_STYLES } from './sound-settings.styles';

/** Locale key of each theme's name, kept next to the data it names. */
const THEME_LABEL_KEYS = {
  neon: 'settings.sound.themes.neon',
  synthwave: 'settings.sound.themes.synthwave',
  glitch: 'settings.sound.themes.glitch',
  terminal: 'settings.sound.themes.terminal',
} as const satisfies Readonly<Record<SoundThemeId, string>>;

interface Draft {
  readonly from: number;
  readonly value: number;
  readonly sent: boolean;
}

interface ThemeRowProps {
  readonly themeId: SoundThemeId;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly playing: boolean;
  readonly onSelect: () => void;
  readonly onPreview: () => void;
}

function ThemeRow({ themeId, checked, disabled, playing, onSelect, onPreview }: ThemeRowProps) {
  const name = i18n.t(THEME_LABEL_KEYS[themeId]);
  return (
    <div className={playing ? 'sound-settings__theme sound-settings__theme--playing' : 'sound-settings__theme'}>
      <label>
        <input type="radio" name="sound-theme" value={themeId} checked={checked} disabled={disabled} onChange={onSelect} />
        <span className="sound-settings__theme-name">{name}</span>
      </label>
      <button
        type="button"
        className="sound-settings__preview"
        aria-label={i18n.t('settings.sound.preview', [name])}
        disabled={disabled}
        onClick={onPreview}
      >
        <span aria-hidden="true">▶</span>
      </button>
    </div>
  );
}

/**
 * The sound controls of the Settings tab (M5.T19): on/off, one theme out of
 * four with a preview each, and the volume. Presentational: it reads the
 * stored preferences through selectors and only ever *asks* the background to
 * change them (`requestSetSoundPreferences`), so it never writes the store.
 * Not locked by the timer: changing a sound mid-session does no harm.
 */
export function SoundSettings() {
  const enabled = useAppStore(selectSoundEnabled);
  const themeId = useAppStore(selectSoundThemeId);
  const stored = useAppStore(selectSoundVolume);
  const { preview, previewingThemeId } = useSoundPreview();
  // The value being dragged lives here and is sent once, on release. It is
  // tied to the stored value it started from, so a change made elsewhere wins,
  // and `sent` stops a pointer release followed by a key release (or the other
  // way round) from asking twice before the store has caught up.
  const [draft, setDraft] = useState<Draft | null>(null);
  const volume = draft !== null && draft.from === stored ? draft.value : stored;
  const request = (patch: SoundPreferencesPatch): void => {
    useAppStore.getState().requestSetSoundPreferences(patch);
  };

  const commitVolume = (): void => {
    if (draft === null || draft.sent || draft.from !== stored) return;
    setDraft({ ...draft, sent: true });
    if (draft.value !== stored) request({ volume: draft.value });
  };
  const valueText = i18n.t('settings.sound.volumeValue', [String(volume)]);

  return (
    <section className="sound-settings" aria-labelledby="sound-settings-heading">
      <style>{SOUND_SETTINGS_STYLES}</style>
      <h3 id="sound-settings-heading" className="sound-settings__heading">
        {i18n.t('settings.sound.heading')}
      </h3>
      <label className="sound-settings__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            request({ enabled: event.target.checked });
          }}
        />
        <span>{i18n.t('settings.sound.enabled')}</span>
      </label>
      <fieldset className="sound-settings__themes">
        <legend>{i18n.t('settings.sound.theme')}</legend>
        {SOUND_THEMES.map((theme) => (
          <ThemeRow
            key={theme.id}
            themeId={theme.id}
            checked={theme.id === themeId}
            disabled={!enabled}
            playing={previewingThemeId === theme.id}
            onSelect={() => {
              request({ themeId: theme.id });
            }}
            onPreview={() => {
              preview(theme.id, volume);
            }}
          />
        ))}
      </fieldset>
      <div className="sound-settings__volume">
        <label htmlFor="sound-volume">{i18n.t('settings.sound.volume')}</label>
        <input
          id="sound-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          disabled={!enabled}
          aria-valuetext={valueText}
          onChange={(event) => {
            setDraft({ from: stored, value: Number(event.target.value), sent: false });
          }}
          onPointerUp={commitVolume}
          onKeyUp={commitVolume}
        />
        <output htmlFor="sound-volume">{valueText}</output>
      </div>
    </section>
  );
}
