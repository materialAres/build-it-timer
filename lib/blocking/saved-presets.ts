import { dropSource } from '@/lib/blocking/preset-toggle';
import type {
  PresetBlocklistState,
  PresetShape,
} from '@/lib/blocking/preset-toggle.types';

// Saved (user) preset operations (CR4.T2, CR4.T1 §3.3–3.4). Pure like the toggle
// logic: same reference back when nothing changes, ids minted by the caller.

/** Longest preset name; the popup is narrow and a name is a button label. */
export const MAX_PRESET_NAME_LENGTH = 24;

/** Prefix that keeps user preset ids from ever colliding with built-in ids. */
const USER_PRESET_PREFIX = 'user:';

export function generatePresetId(now: number, random: number): string {
  return `${USER_PRESET_PREFIX}${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

function cleanName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PRESET_NAME_LENGTH
    ? trimmed
    : null;
}

/** Names are unique case-insensitively across built-in and user presets. */
function isNameTaken(
  name: string,
  presets: ReadonlyArray<PresetShape>,
  exceptId?: string,
): boolean {
  const target = name.toLowerCase();
  return presets.some(
    (preset) => preset.id !== exceptId && preset.name.toLowerCase() === target,
  );
}

/**
 * Save the whole current list as a new user preset (CR4.T1 §3.4): the preset is
 * marked applied and each captured entry takes it as a source and drops `manual`,
 * so switching the preset off removes exactly what it captured. Rejected (same
 * reference) for an empty list, a blank/long/duplicate name or a taken id.
 */
export function saveUserPreset(
  state: PresetBlocklistState,
  id: string,
  name: string,
  builtIn: ReadonlyArray<PresetShape>,
): PresetBlocklistState {
  const cleaned = cleanName(name);
  const known = [...builtIn, ...state.userPresets];
  if (cleaned === null || id.length === 0 || state.blocklist.length === 0)
    return state;
  if (isNameTaken(cleaned, known) || known.some((preset) => preset.id === id))
    return state;

  const preset: PresetShape = {
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
  state: PresetBlocklistState,
  id: string,
  name: string,
  builtIn: ReadonlyArray<PresetShape>,
): PresetBlocklistState {
  const target = state.userPresets.find((preset) => preset.id === id);
  const cleaned = cleanName(name);
  if (target === undefined || cleaned === null || cleaned === target.name)
    return state;
  if (isNameTaken(cleaned, [...builtIn, ...state.userPresets], id))
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
  state: PresetBlocklistState,
  id: string,
): PresetBlocklistState {
  if (!state.userPresets.some((preset) => preset.id === id)) return state;
  return {
    blocklist: dropSource(state, id, true),
    appliedPresetIds: state.appliedPresetIds.filter(
      (applied) => applied !== id,
    ),
    userPresets: state.userPresets.filter((preset) => preset.id !== id),
  };
}
