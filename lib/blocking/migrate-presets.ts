import { PRESETS } from '@/lib/blocking/presets';
import { USER_PRESET_PREFIX } from '@/lib/blocking/saved-presets';
import { sanitizeBlocklistState } from '@/lib/blocking/blocklist-state';
import {
  migrateBlocklistState,
  sanitizeV2Blocklist,
  type EffectiveBlocklist,
} from '@/lib/blocking/legacy-blocklist';
import type {
  BlocklistEntry,
  BlocklistState,
  Preset,
} from '@/store/store.types';

/**
 * Version 2 → 3 migration (CR4.T3, rules in docs/features-analysis/saved-presets.md
 * §5): custom tags become user presets and tagged entries get preset sources.
 *
 * - a tag id equal to a built-in preset id keeps that preset as the source;
 * - a custom tag becomes the user preset `user:<tag id>` (name = label, domains
 *   = the entries that carried it) and is marked applied, because its sites are
 *   on the list right now;
 * - an unknown tag id is dropped; an entry left with no preset source becomes
 *   `manual`;
 * - a tag with no entries becomes an empty, un-applied preset (nothing the user
 *   made is silently lost).
 *
 * Accepted limit: v2 cannot tell an entry typed by hand *and* tagged from a
 * tag-only one, so such an entry migrates without `manual`.
 *
 * Total and pure (§1.4): the input is already sanitized by
 * `sanitizeV2Blocklist`; the built-in presets are injectable for tests.
 */
export function migrateToPresets(
  legacy: EffectiveBlocklist,
  builtIn: ReadonlyArray<Preset> = PRESETS,
): BlocklistState {
  const builtInIds = new Set(builtIn.map((preset) => preset.id));
  const customIds = new Set(legacy.customTags.map((tag) => tag.id));
  const resolve = (tagId: string): string | null => {
    if (builtInIds.has(tagId)) return tagId;
    return customIds.has(tagId) ? `${USER_PRESET_PREFIX}${tagId}` : null;
  };

  const applied: string[] = [];
  const blocklist: BlocklistEntry[] = legacy.blocklist.map((entry) => {
    const presetIds = [
      ...new Set(
        entry.tagIds.flatMap((tagId) => {
          const id = resolve(tagId);
          return id === null ? [] : [id];
        }),
      ),
    ];
    for (const id of presetIds) if (!applied.includes(id)) applied.push(id);
    return { domain: entry.domain, manual: presetIds.length === 0, presetIds };
  });

  const userPresets: Preset[] = legacy.customTags.map((tag) => ({
    id: `${USER_PRESET_PREFIX}${tag.id}`,
    name: tag.label,
    domains: legacy.blocklist
      .filter((entry) => entry.tagIds.includes(tag.id))
      .map((entry) => entry.domain),
  }));

  return { blocklist, appliedPresetIds: applied, userPresets };
}

/**
 * Brings a persisted blocklist of any version to the version 3 shape: v1 first
 * loses its allowlist (`migrateBlocklistState`, CR1.T3), v2 is sanitized, both
 * then become presets (`migrateToPresets`); v3 is only sanitized. Always total:
 * unrecognised data degrades to an empty blocklist.
 */
export function migratePersistedBlocklist(
  raw: unknown,
  version: number,
): BlocklistState {
  if (version >= 3) return sanitizeBlocklistState(raw);
  const v2 =
    version < 2 ? migrateBlocklistState(raw) : sanitizeV2Blocklist(raw);
  return migrateToPresets(v2);
}
