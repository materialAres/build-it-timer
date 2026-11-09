import { getPresetById } from '@/lib/blocking/presets';
import { dropSource } from '@/lib/blocking/preset-toggle';
import type { BlocklistState, Preset } from '@/store/store.types';

// Saved (user) preset operations (CR4.T2, CR4.T1 §3.3–3.4). Pure like the toggle
// logic: same reference back when nothing changes, ids minted by the caller.

/** Longest preset name; the popup is narrow and a name is a button label. */
export const MAX_PRESET_NAME_LENGTH = 24;

/** Prefix that keeps user preset ids from ever colliding with built-in ids. */
export const USER_PRESET_PREFIX = 'user:';

export function generatePresetId(now: number, random: number): string {
  return `${USER_PRESET_PREFIX}${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

/** Why a preset name is refused; `null` from the validator means it is free. */
export type PresetNameError = 'empty' | 'tooLong' | 'taken';

/**
 * The single name rule (CR4.T5): trimmed, 1–24 characters, unique
 * case-insensitively across built-in and user presets (the preset being
 * renamed excluded). Shared by the pure save/rename functions and the popup, so
 * the UI can say *why* a name is refused instead of silently doing nothing.
 */
export function validatePresetName(
  name: string,
  presets: ReadonlyArray<Preset>,
  exceptId?: string,
): PresetNameError | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > MAX_PRESET_NAME_LENGTH) return 'tooLong';
  const target = trimmed.toLowerCase();
  const taken = presets.some(
    (preset) => preset.id !== exceptId && preset.name.toLowerCase() === target,
  );
  return taken ? 'taken' : null;
}

/**
 * Save the whole current list as a new user preset (CR4.T1 §3.4): the preset is
 * marked applied and each captured entry takes it as a source and drops `manual`,
 * so switching the preset off removes exactly what it captured. Rejected (same
 * reference) for an empty list, a blank/long/duplicate name or a taken id.
 */
export function saveUserPreset(
  state: BlocklistState,
  id: string,
  name: string,
  builtIn: ReadonlyArray<Preset>,
): BlocklistState {
  const known = [...builtIn, ...state.userPresets];
  if (id.length === 0 || state.blocklist.length === 0) return state;
  if (validatePresetName(name, known) !== null) return state;
  if (known.some((preset) => preset.id === id)) return state;
  const cleaned = name.trim();

  const preset: Preset = {
    id,
    name: cleaned,
    domains: state.blocklist.map((entry) => entry.domain),
  };
  return {
    blocklist: state.blocklist.map((entry) => ({
      ...entry,
      manual: false,
      presetIds: [...entry.presetIds, id],
    })),
    appliedPresetIds: [...state.appliedPresetIds, id],
    userPresets: [...state.userPresets, preset],
  };
}

/** Rename a user preset; built-in or unknown ids and invalid names are no-ops. */
export function renameUserPreset(
  state: BlocklistState,
  id: string,
  name: string,
  builtIn: ReadonlyArray<Preset>,
): BlocklistState {
  const target = state.userPresets.find((preset) => preset.id === id);
  const cleaned = name.trim();
  if (target === undefined || cleaned === target.name) return state;
  if (validatePresetName(name, [...builtIn, ...state.userPresets], id) !== null)
    return state;

  return {
    ...state,
    userPresets: state.userPresets.map((preset) =>
      preset.id === id ? { ...preset, name: cleaned } : preset,
    ),
  };
}

/**
 * Delete a user preset. Deleting a group must not unblock anything, so entries
 * it alone contributed stay on the list as manual entries.
 */
export function deleteUserPreset(
  state: BlocklistState,
  id: string,
): BlocklistState {
  if (!state.userPresets.some((preset) => preset.id === id)) return state;
  return {
    blocklist: dropSource(state, id, true),
    appliedPresetIds: state.appliedPresetIds.filter(
      (applied) => applied !== id,
    ),
    userPresets: state.userPresets.filter((preset) => preset.id !== id),
  };
}

/** A preset by id: the built-in ones first, then the user's saved presets. */
export function findPreset(
  state: BlocklistState,
  presetId: string,
): Preset | undefined {
  return (
    getPresetById(presetId) ??
    state.userPresets.find((preset) => preset.id === presetId)
  );
}
