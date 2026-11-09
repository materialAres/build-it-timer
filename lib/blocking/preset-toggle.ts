import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import type {
  PresetBlocklistState,
  PresetCoverage,
  PresetShape,
  SourcedEntry,
} from '@/lib/blocking/preset-toggle.types';

// Pure preset toggle logic (CR4.T2, decisions in docs/features-analysis/saved-presets.md).
// Every function returns the *same* state reference when nothing changes, so the
// store and the background can skip a write (identity pattern of M1.T10), and
// never reads the clock or entropy. Saved-preset operations live in
// `saved-presets.ts`.

export function isPresetApplied(
  state: PresetBlocklistState,
  presetId: string,
): boolean {
  return state.appliedPresetIds.includes(presetId);
}

export function computePresetCoverage(
  state: PresetBlocklistState,
  preset: PresetShape,
): PresetCoverage {
  const carried = new Set(
    state.blocklist
      .filter((entry) => entry.presetIds.includes(preset.id))
      .map((entry) => entry.domain.value),
  );
  const covered = preset.domains.filter((domain) => {
    const normalized = normalizeEntry(domain.value);
    return normalized.ok && carried.has(normalized.value);
  }).length;
  return { covered, total: preset.domains.length };
}

/**
 * Switch a preset on or off. The target state is explicit rather than a flip, so
 * a redelivered message cannot invert the result.
 *
 * On: add the preset's missing domains (canonicalized through `normalizeEntry`,
 * invalid ones skipped) and record the preset as a source of each; a domain
 * already listed keeps its other sources. Re-applying also restores domains the
 * user removed with ×.
 *
 * Off: drop the preset id from the applied set and from *every* entry (by id,
 * not by the preset's current domains) and delete only entries left with no
 * source — a manual entry, or one another applied preset covers, survives.
 */
export function togglePreset(
  state: PresetBlocklistState,
  preset: PresetShape,
  applied: boolean,
): PresetBlocklistState {
  return applied ? applyPreset(state, preset) : unapplyPreset(state, preset.id);
}

function applyPreset(
  state: PresetBlocklistState,
  preset: PresetShape,
): PresetBlocklistState {
  const entries: SourcedEntry[] = [...state.blocklist];
  const indexByDomain = new Map(
    entries.map((entry, index) => [entry.domain.value, index]),
  );
  let changed = false;

  for (const raw of preset.domains) {
    const normalized = normalizeEntry(raw.value);
    if (!normalized.ok) continue;

    const index = indexByDomain.get(normalized.value);
    const existing = index === undefined ? undefined : entries[index];
    if (index === undefined || existing === undefined) {
      indexByDomain.set(normalized.value, entries.length);
      entries.push({
        domain: { value: normalized.value },
        manual: false,
        presetIds: [preset.id],
      });
      changed = true;
    } else if (!existing.presetIds.includes(preset.id)) {
      entries[index] = {
        ...existing,
        presetIds: [...existing.presetIds, preset.id],
      };
      changed = true;
    }
  }

  const wasApplied = isPresetApplied(state, preset.id);
  if (!changed && wasApplied) return state;
  return {
    ...state,
    blocklist: changed ? entries : state.blocklist,
    appliedPresetIds: wasApplied
      ? state.appliedPresetIds
      : [...state.appliedPresetIds, preset.id],
  };
}

function withoutSource(
  entry: SourcedEntry,
  presetId: string,
  orphanBecomesManual: boolean,
): SourcedEntry | null {
  if (!entry.presetIds.includes(presetId)) return entry;
  const presetIds = entry.presetIds.filter((id) => id !== presetId);
  if (entry.manual || presetIds.length > 0) return { ...entry, presetIds };
  return orphanBecomesManual ? { ...entry, manual: true, presetIds } : null;
}

export function dropSource(
  state: PresetBlocklistState,
  presetId: string,
  orphanBecomesManual: boolean,
): ReadonlyArray<SourcedEntry> {
  return state.blocklist.flatMap((entry) => {
    const next = withoutSource(entry, presetId, orphanBecomesManual);
    return next === null ? [] : [next];
  });
}

function unapplyPreset(
  state: PresetBlocklistState,
  presetId: string,
): PresetBlocklistState {
  const carried = state.blocklist.some((entry) =>
    entry.presetIds.includes(presetId),
  );
  if (!carried && !isPresetApplied(state, presetId)) return state;
  return {
    ...state,
    blocklist: dropSource(state, presetId, false),
    appliedPresetIds: state.appliedPresetIds.filter((id) => id !== presetId),
  };
}
