import type { Preset, Tag } from '@/store/store.types';

/**
 * Human-readable sources of a blocklist entry (UI.T1): the presets and custom
 * tags it carries, resolved to their display names, in the entry's own order
 * and without repeats. An entry with no tags was added by hand and has no
 * source label. Ids that no longer resolve (a deleted tag) are skipped, so a
 * stale id never shows up as raw text in the list.
 *
 * Interim until CR4 replaces `tagIds` with explicit entry sources.
 */
export function computeEntrySourceLabels(
  tagIds: ReadonlyArray<string>,
  presets: ReadonlyArray<Preset>,
  customTags: ReadonlyArray<Tag>,
): ReadonlyArray<string> {
  const labelById = new Map<string, string>();
  for (const tag of customTags) labelById.set(tag.id, tag.label);
  for (const preset of presets) labelById.set(preset.tag.id, preset.name);

  const labels: string[] = [];
  for (const id of tagIds) {
    const label = labelById.get(id);
    if (label !== undefined && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
