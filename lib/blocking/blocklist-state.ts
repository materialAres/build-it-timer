import { PRESETS } from '@/lib/blocking/presets';
import type {
  BlocklistEntry,
  BlocklistState,
  Preset,
} from '@/store/store.types';

export const EMPTY_BLOCKLIST_STATE: BlocklistState = {
  blocklist: [],
  appliedPresetIds: [],
  userPresets: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

function toStrings(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}

function toDomains(value: unknown): Preset['domains'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) =>
    isRecord(candidate) && isNonEmptyString(candidate.value)
      ? [{ value: candidate.value }]
      : [],
  );
}

/** Valid user presets only; a built-in or repeated id never gets a second preset. */
function toUserPresets(value: unknown): ReadonlyArray<Preset> {
  if (!Array.isArray(value)) return [];

  const taken = new Set(PRESETS.map((preset) => preset.id));
  const presets: Preset[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const { id, name } = candidate;
    if (!isNonEmptyString(id) || typeof name !== 'string' || taken.has(id))
      continue;
    taken.add(id);
    presets.push({ id, name, domains: toDomains(candidate.domains) });
  }
  return presets;
}

function toEntries(
  value: unknown,
  applied: ReadonlySet<string>,
): ReadonlyArray<BlocklistEntry> {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: BlocklistEntry[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !isRecord(candidate.domain)) continue;
    const domain = candidate.domain.value;
    if (!isNonEmptyString(domain) || seen.has(domain)) continue;
    seen.add(domain);

    const presetIds = [
      ...new Set(
        toStrings(candidate.presetIds).filter((id) => applied.has(id)),
      ),
    ];
    // An entry must keep a source: one left with none is a manual entry rather
    // than silently dropped, so a corrupted payload never unblocks a site.
    const manual = candidate.manual === true || presetIds.length === 0;
    entries.push({ domain: { value: domain }, manual, presetIds });
  }
  return entries;
}

/**
 * Rebuilds a persisted version 3 blocklist from untrusted data (CR4.T3).
 *
 * Total by construction (§1.4): a missing or malformed field degrades to an
 * empty array instead of throwing, duplicates collapse (first wins), the applied
 * set only keeps ids that name a real preset, and an entry only keeps sources
 * that are applied — the invariants the pure preset logic relies on.
 */
export function sanitizeBlocklistState(value: unknown): BlocklistState {
  if (!isRecord(value)) return EMPTY_BLOCKLIST_STATE;

  const userPresets = toUserPresets(value.userPresets);
  const known = new Set([
    ...PRESETS.map((preset) => preset.id),
    ...userPresets.map((preset) => preset.id),
  ]);
  const appliedPresetIds = [
    ...new Set(toStrings(value.appliedPresetIds).filter((id) => known.has(id))),
  ];
  return {
    blocklist: toEntries(value.blocklist, new Set(appliedPresetIds)),
    appliedPresetIds,
    userPresets,
  };
}
