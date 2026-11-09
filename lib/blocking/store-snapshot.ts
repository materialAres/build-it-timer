import { ok, err, type Result } from '@/utils/result';
import type { TimerStatus } from '@/store/store.types';
import type { BlockDecisionInput, BlockedEntry } from './is-domain-blocked';
import { migrateBlocklistState } from './legacy-blocklist';

/** The persisted key the store writes to (`store/index.ts`, `STORE_NAME`). */
export const STORE_STORAGE_KEY = 'timer-focus-store';

/** The part of the persisted payload a content script needs to gate a page. */
export interface StoreSnapshot extends BlockDecisionInput {
  readonly timerStatus: TimerStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * An entry is valid when it names a domain; the sources a version 3 entry adds
 * (`manual`, `presetIds`) are checked only when present, and a version 2 entry
 * (`tagIds`) is accepted as is, because enforcement reads the domain alone
 * (CR4.T3) and storage still holds version 2 until the background rewrites it.
 */
function isBlocklistEntry(value: unknown): value is BlockedEntry {
  if (!isRecord(value) || !isRecord(value.domain)) return false;
  if (typeof value.domain.value !== 'string') return false;
  if (value.manual !== undefined && typeof value.manual !== 'boolean')
    return false;
  const { presetIds } = value;
  return (
    presetIds === undefined ||
    (Array.isArray(presetIds) &&
      presetIds.every((id) => typeof id === 'string'))
  );
}

function isBlocklistEntryList(
  value: unknown,
): value is ReadonlyArray<BlockedEntry> {
  return Array.isArray(value) && value.every(isBlocklistEntry);
}

function isTimerStatus(value: unknown): value is TimerStatus {
  return (
    value === 'idle' ||
    value === 'running' ||
    value === 'paused' ||
    value === 'completed'
  );
}

/**
 * Parses the raw persisted envelope into the snapshot the overlay needs.
 *
 * The persisted value is `zustand/persist`'s own envelope
 * (`{ state, version }`) and is read from `browser.storage.local`, which is an
 * untrusted boundary (§1.4): a partially written, hand-edited, or
 * future-version payload must not crash the content script, so every field is
 * validated with a guard and a malformed shape yields `{ ok: false }` instead
 * of a throw (no `as` casts).
 *
 * Every blocklist shape is accepted (CR1.T4, CR4.T3): version 3
 * (`{ blocklist, appliedPresetIds, userPresets }`), version 2 (`customTags`,
 * tagged entries) and the legacy version 1, which also has a second list. The
 * content script reads the raw value and does not run zustand's migration, so the legacy shape is delegated to
 * `migrateBlocklistState` here — the only module allowed to interpret it. A
 * blocklist field that is present but malformed is still rejected rather than
 * silently treated as empty.
 */
export function parseStoreSnapshot(raw: unknown): Result<StoreSnapshot> {
  if (typeof raw !== 'string' || raw.length === 0) {
    return err(new Error('Persisted store value is not a JSON string'));
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }

  if (!isRecord(envelope) || !isRecord(envelope.state)) {
    return err(new Error('Persisted store value has no state envelope'));
  }

  const { blocklist, timer } = envelope.state;
  if (!isRecord(blocklist))
    return err(new Error('Persisted store has no blocklist'));

  if (!isBlocklistEntryList(blocklist.blocklist)) {
    return err(new Error('Persisted blocklist is malformed'));
  }

  const status = isRecord(timer) ? timer.status : undefined;
  if (!isTimerStatus(status)) {
    return err(new Error('Persisted store has no valid timer status'));
  }

  return ok({
    timerStatus: status,
    blocklist: migrateBlocklistState(blocklist).blocklist,
  });
}
