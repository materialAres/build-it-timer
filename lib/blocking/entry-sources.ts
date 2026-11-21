import type { Preset } from '@/store/store.types';

/**
 * Human-readable sources of a blocklist entry (UI.T1, CR4.T3): the names of the
 * presets that contributed it, in the entry's own order and without repeats. A
 * manual-only entry has no chip. Ids that no longer resolve (a deleted preset)
 * are skipped, so a stale id never shows up as raw text in the list.
 */
export function computeEntrySourceLabels(
  presetIds: ReadonlyArray<string>,
  presets: ReadonlyArray<Preset>,
): ReadonlyArray<string> {
  const nameById = new Map(presets.map((preset) => [preset.id, preset.name]));
  const labels: string[] = [];
  for (const id of presetIds) {
    const name = nameById.get(id);
    if (name !== undefined && !labels.includes(name)) labels.push(name);
  }
  return labels;
}
