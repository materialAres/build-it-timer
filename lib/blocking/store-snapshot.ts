import { ok, err, type Result } from '@/utils/result';
import type { BlocklistEntry, TimerStatus } from '@/store/store.types';
import type { BlockDecisionInput } from './is-domain-blocked';

/** The persisted key the store writes to (`store/index.ts`, `STORE_NAME`). */
export const STORE_STORAGE_KEY = 'timer-focus-store';

/** The part of the persisted payload a content script needs to gate a page. */
export interface StoreSnapshot extends BlockDecisionInput {
  readonly timerStatus: TimerStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBlocklistEntry(value: unknown): value is BlocklistEntry {
  if (!isRecord(value) || !isRecord(value.domain)) return false;
  if (typeof value.domain.value !== 'string') return false;
  return Array.isArray(value.tagIds) && value.tagIds.every((id) => typeof id === 'string');
}

function isBlocklistEntryList(value: unknown): value is ReadonlyArray<BlocklistEntry> {
  return Array.isArray(value) && value.every(isBlocklistEntry);
}

function isTimerStatus(value: unknown): value is TimerStatus {
  return value === 'idle' || value === 'running' || value === 'paused';
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
  if (!isRecord(blocklist)) return err(new Error('Persisted store has no blocklist'));

  const { allowlist, blocklist: blocked } = blocklist;
  if (!isBlocklistEntryList(allowlist) || !isBlocklistEntryList(blocked)) {
    return err(new Error('Persisted blocklist is malformed'));
  }

  const status = isRecord(timer) ? timer.status : undefined;
  if (!isTimerStatus(status)) {
    return err(new Error('Persisted store has no valid timer status'));
  }

  return ok({ timerStatus: status, allowlist, blocklist: blocked });
}
