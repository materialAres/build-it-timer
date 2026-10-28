import type { BlocklistEntry, Tag } from '@/store/store.types';

/**
 * The legacy two-list blocklist shape (persist version 1). It is declared here
 * to document what the one-time migration consumes (CR1.T3); no runtime code
 * outside this module reads `allowlist` anymore.
 */
export interface LegacyBlocklistState {
  readonly allowlist?: ReadonlyArray<BlocklistEntry>;
  readonly blocklist?: ReadonlyArray<BlocklistEntry>;
  readonly customTags?: ReadonlyArray<Tag>;
}

/** The single-list blocklist shape persisted from version 2 onward (CR1.T3). */
export interface EffectiveBlocklist {
  readonly blocklist: ReadonlyArray<BlocklistEntry>;
  readonly customTags: ReadonlyArray<Tag>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Rebuilds one entry from untrusted data. The domain is kept verbatim: persisted
 * values are already canonical (M1.T2), and re-parsing them here could change
 * what the user currently experiences as blocked.
 */
function toEntry(value: unknown): BlocklistEntry | null {
  if (!isRecord(value) || !isRecord(value.domain)) return null;
  const domain = value.domain.value;
  if (typeof domain !== 'string' || domain.length === 0) return null;

  const tagIds = Array.isArray(value.tagIds)
    ? value.tagIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { domain: { value: domain }, tagIds };
}

/**
 * Valid entries only, first occurrence wins, so a corrupted payload that repeats
 * a domain can never introduce a duplicate entry.
 */
function toEntries(value: unknown): ReadonlyArray<BlocklistEntry> {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: BlocklistEntry[] = [];
  for (const candidate of value) {
    const entry = toEntry(candidate);
    if (entry === null || seen.has(entry.domain.value)) continue;
    seen.add(entry.domain.value);
    entries.push(entry);
  }
  return entries;
}

function isTag(value: unknown): value is Tag {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string'
  );
}

function toTags(value: unknown): ReadonlyArray<Tag> {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: Tag[] = [];
  for (const candidate of value) {
    if (!isTag(candidate) || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    tags.push(candidate);
  }
  return tags;
}

/**
 * Normalizes a persisted blocklist payload to the single-list shape.
 *
 * Total by construction (§1.4): a missing or malformed field degrades to an
 * empty array instead of throwing. A legacy `allowlist` field is *ignored* here
 * rather than applied as precedence — only `migrateBlocklistState` performs the
 * one-time subtraction, so a forged version-2 payload cannot resurrect the
 * obsolete "allowlist wins" rule (CR1.T3).
 */
export function sanitizeBlocklistState(value: unknown): EffectiveBlocklist {
  if (!isRecord(value)) return { blocklist: [], customTags: [] };
  return {
    blocklist: toEntries(value.blocklist),
    customTags: toTags(value.customTags),
  };
}

/**
 * One-time migration from the two-list shape (persist version 1) to the
 * single-list shape (version 2, CR1.T3).
 *
 * A domain present in both lists stays unblocked, which is exactly what the
 * user experiences today ("allowlist wins", M2.T6/M2.T20). A domain present only
 * in the allowlist is dropped instead of promoted: every non-blocklisted site is
 * already allowed by default, so it needs no replacement entry.
 *
 * This is the only runtime path allowed to read a legacy `allowlist`.
 */
export function migrateBlocklistState(legacy: unknown): EffectiveBlocklist {
  const sanitized = sanitizeBlocklistState(legacy);
  if (!isRecord(legacy)) return sanitized;

  const allowed = new Set(
    toEntries(legacy.allowlist).map((entry) => entry.domain.value),
  );
  if (allowed.size === 0) return sanitized;

  return {
    ...sanitized,
    blocklist: sanitized.blocklist.filter(
      (entry) => !allowed.has(entry.domain.value),
    ),
  };
}
