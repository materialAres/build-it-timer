import { i18n } from '#i18n';
import { useId, useState, type SyntheticEvent } from 'react';
import {
  MAX_PRESET_NAME_LENGTH,
  validatePresetName,
  type PresetNameError,
} from '@/lib/blocking/saved-presets';
import type { Preset } from '@/store/store.types';

interface PresetNameFormProps {
  readonly initialName?: string;
  /** Every preset, to check the name is free (the renamed one excluded). */
  readonly presets: ReadonlyArray<Preset>;
  readonly exceptId?: string;
  readonly inputLabel: string;
  readonly submitLabel: string;
  /** A standing explanation shown under the field (what saving does). */
  readonly note?: string;
  readonly disabled: boolean;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
}

function errorText(error: PresetNameError): string {
  if (error === 'empty') return i18n.t('blocklist.presetNameEmpty');
  if (error === 'tooLong')
    return i18n.t('blocklist.presetNameTooLong', [
      String(MAX_PRESET_NAME_LENGTH),
    ]);
  return i18n.t('blocklist.presetNameTaken');
}

/**
 * The name field shared by "save as preset" and "rename" (CR4.T5). It runs the
 * same `validatePresetName` rule as the store, so a refused name is explained
 * here instead of being silently ignored by the action.
 */
export function PresetNameForm({
  initialName = '',
  presets,
  exceptId,
  inputLabel,
  submitLabel,
  note,
  disabled,
  onSubmit,
  onCancel,
}: PresetNameFormProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<PresetNameError | null>(null);
  const noteId = useId();

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = validatePresetName(name, presets, exceptId);
    if (result !== null) {
      setError(result);
      return;
    }
    onSubmit(name.trim());
  };

  const message = error === null ? note : errorText(error);

  return (
    <form className="preset-form" onSubmit={handleSubmit}>
      <input
        className="preset-form__input"
        type="text"
        value={name}
        disabled={disabled}
        aria-label={inputLabel}
        aria-invalid={error !== null}
        aria-describedby={message === undefined ? undefined : noteId}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
      />
      <button
        type="submit"
        className="preset-picker__action"
        disabled={disabled}
      >
        {submitLabel}
      </button>
      <button
        type="button"
        className="preset-picker__action"
        onClick={onCancel}
      >
        {i18n.t('blocklist.cancel')}
      </button>
      {message === undefined ? null : (
        <p
          id={noteId}
          className={
            error === null
              ? 'preset-form__note'
              : 'preset-form__note preset-form__note--error'
          }
          role={error === null ? undefined : 'alert'}
        >
          {message}
        </p>
      )}
    </form>
  );
}
