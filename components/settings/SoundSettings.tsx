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
import { useVolumeDraft, type VolumeDraft } from './use-volume-draft';
import { SOUND_SETTINGS_STYLES } from './sound-settings.styles';

/** Locale key of each theme's name, kept next to the data it names. */
const THEME_LABEL_KEYS = {
  neon: 'settings.sound.themes.neon',
  synthwave: 'settings.sound.themes.synthwave',
  glitch: 'settings.sound.themes.glitch',
  terminal: 'settings.sound.themes.terminal',
} as const satisfies Readonly<Record<SoundThemeId, string>>;

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

interface VolumeSliderProps {
  readonly volume: VolumeDraft;
  readonly disabled: boolean;
}

function VolumeSlider({ volume, disabled }: VolumeSliderProps) {
  const valueText = i18n.t('settings.sound.volumeValue', [String(volume.value)]);
  return (
    <div className="sound-settings__volume">
      <label htmlFor="sound-volume">{i18n.t('settings.sound.volume')}</label>
      <input
        id="sound-volume"
        type="range"
        min={0}
        max={100}
        step={5}
        value={volume.value}
        disabled={disabled}
        aria-valuetext={valueText}
        onChange={(event) => {
          volume.change(Number(event.target.value));
        }}
        onPointerUp={volume.commit}
        onKeyUp={volume.commit}
      />
      <output htmlFor="sound-volume">{valueText}</output>
    </div>
  );
}

const request = (patch: SoundPreferencesPatch): void => {
  useAppStore.getState().requestSetSoundPreferences(patch);
};

/**
 * The sound controls of the Settings tab (M5.T19): on/off, one theme out of
 * four with a preview each, and the volume, sent once on release. It reads the
 * stored preferences through selectors and only ever *asks* the background to
 * change them, so it never writes the store. Not locked by the timer.
 */
export function SoundSettings() {
  const enabled = useAppStore(selectSoundEnabled);
  const themeId = useAppStore(selectSoundThemeId);
  const volume = useVolumeDraft(useAppStore(selectSoundVolume), (value) => {
    request({ volume: value });
  });
  const { preview, previewingThemeId } = useSoundPreview();

  return (
    <section className="sound-settings" aria-labelledby="sound-settings-heading">
      <style>{SOUND_SETTINGS_STYLES}</style>
      <h3 id="sound-settings-heading" className="sound-settings__heading">
        {i18n.t('settings.sound.heading')}
      </h3>
      <label className="sound-settings__toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => { request({ enabled: event.target.checked }); }} />
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
            onSelect={() => { request({ themeId: theme.id }); }}
            onPreview={() => { preview(theme.id, volume.value); }}
          />
        ))}
      </fieldset>
      <VolumeSlider volume={volume} disabled={!enabled} />
    </section>
  );
}
