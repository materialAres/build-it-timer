import { i18n } from '#i18n';
import {
  selectIsPresetApplied,
  selectPresetCoveredCount,
  useAppStore,
} from '@/store';
import type { Preset } from '@/store/store.types';

interface PresetToggleProps {
  readonly preset: Preset;
  /** Whether the list may be reshaped (`idle`): needed to switch a preset off. */
  readonly editable: boolean;
  /** Whether the list may grow (`idle`, `running`, `paused`): switching on. */
  readonly addAllowed: boolean;
}

/**
 * One preset as a toggle (CR4.T5, UI.T2). `aria-pressed` carries the state; the
 * count is how many of its sites the list blocks for it (`3/4` once one was
 * removed by hand, the plain total while it is off, so the user knows what it
 * would add). Its domains are listed in the tooltip, inspectable before the
 * click. The component only invokes `togglePreset` with the target state.
 *
 * Mid-session (CR5.T3) a preset can still be switched on but not off, so the
 * disabled state depends on which way the click would go.
 */
export function PresetToggle({
  preset,
  editable,
  addAllowed,
}: PresetToggleProps) {
  const applied = useAppStore(selectIsPresetApplied(preset.id));
  const covered = useAppStore(selectPresetCoveredCount(preset));
  const total = preset.domains.length;
  const count =
    !applied || covered === total
      ? String(total)
      : `${String(covered)}/${String(total)}`;
  const domains = preset.domains.map((domain) => domain.value).join(', ');

  return (
    <button
      type="button"
      className="preset-picker__button"
      data-preset-id={preset.id}
      aria-pressed={applied}
      disabled={applied ? !editable : !addAllowed}
      aria-label={i18n.t('blocklist.presetToggle', [
        preset.name,
        String(covered),
        String(total),
      ])}
      title={
        total === 0
          ? i18n.t('blocklist.presetNoSites')
          : i18n.t('blocklist.presetDomains', [domains])
      }
      onClick={() => {
        useAppStore.getState().togglePreset(preset.id, !applied);
      }}
    >
      {preset.name}
      <span className="preset-picker__count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
