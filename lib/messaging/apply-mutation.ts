import type { AppStore } from '@/store';
import { getPresetById } from '@/lib/blocking/presets';
import {
  addSiteToList,
  addPresetToList,
  assignTagToSite,
  unassignTagFromSite,
  removeSiteFromList,
  upsertTag,
  removeTag,
  type BlocklistListName,
  type BlocklistState,
} from '@/store';
import type { MutationMessage } from './messages.types';
import type { Tag } from '@/store/store.types';

function isListName(value: unknown): value is BlocklistListName {
  return value === 'allowlist' || value === 'blocklist';
}

function isTag(value: unknown): value is Tag {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; label?: unknown };
  return typeof candidate.id === 'string' && typeof candidate.label === 'string';
}

/**
 * Apply one blocklist/tag mutation to the blocklist state. Returns the *same*
 * reference when the payload is malformed or unknown, so an invalid message
 * neither mutates the store nor triggers a persist (forward-compatible with
 * M5.T1 hardening).
 *
 * The semantics stay deliberately minimal here: normalization (M2.T4/M2.T21),
 * dedup and allowlist precedence (M2.T20), preset expansion (M2.T5) and the DNR
 * side-effect (M2.T7) are owned by those tasks.
 */
function applyBlocklistMutation(
  state: BlocklistState,
  message: MutationMessage,
): BlocklistState {
  switch (message.type) {
    case 'BLOCKLIST_ADD_SITE': {
      const { list, site } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || site.length === 0) return state;
      return addSiteToList(state, list, site);
    }
    case 'BLOCKLIST_REMOVE_SITE': {
      const { list, site } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || site.length === 0) return state;
      return removeSiteFromList(state, list, site);
    }
    case 'BLOCKLIST_APPLY_PRESET': {
      const { presetId } = message.payload;
      if (typeof presetId !== 'string' || presetId.length === 0) return state;
      const preset = getPresetById(presetId);
      if (preset === undefined) return state;
      // The whole preset is expanded in a single state update (M3.T1), so the
      // mutation persists once no matter how many domains it contains.
      return addPresetToList(state, 'blocklist', preset);
    }
    case 'TAG_UPSERT': {
      if (!isTag(message.payload)) return state;
      return upsertTag(state, message.payload);
    }
    case 'TAG_REMOVE': {
      const { tagId } = message.payload;
      if (typeof tagId !== 'string' || tagId.length === 0) return state;
      return removeTag(state, tagId);
    }
    case 'TAG_ASSIGN': {
      const { list, site, tagId } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || typeof tagId !== 'string') {
        return state;
      }
      return assignTagToSite(state, list, site, tagId);
    }
    case 'TAG_UNASSIGN': {
      const { list, site, tagId } = message.payload;
      if (!isListName(list) || typeof site !== 'string' || typeof tagId !== 'string') {
        return state;
      }
      return unassignTagFromSite(state, list, site, tagId);
    }
    default:
      return state;
  }
}

/**
 * Whether a timer mutation carries the empty payload its variant declares. The
 * payload is untrusted (M5.T1), so a forged message with extra fields is
 * rejected rather than silently accepted.
 */
function hasEmptyPayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Object.keys(payload).length === 0
  );
}

/**
 * Mutation handler for the cross-context path (M1.T10, extended by M3.T3b): the
 * popup sends a typed mutation, the background applies it to its single writable
 * store (M1.T9) and the change propagates back to the popup through the M1.T8
 * sync bridge.
 *
 * Two families share the path. Blocklist/tag mutations are pure state
 * transformations applied here. Timer mutations are *commands*: they invoke the
 * background's own timer slice (M2.T1), which is what schedules/clears the
 * session alarm on the background's provider — the popup's copy is read-only
 * (M1.T9) and its provider is not the one the alarm must live on.
 */
export function createMutationHandler(store: AppStore) {
  return (message: MutationMessage): void => {
    switch (message.type) {
      case 'TIMER_STARTED':
        if (!hasEmptyPayload(message.payload)) return;
        void store.getState().startTimer();
        return;
      case 'TIMER_PAUSED':
        if (!hasEmptyPayload(message.payload)) return;
        void store.getState().pauseTimer();
        return;
      case 'TIMER_RESET':
        if (!hasEmptyPayload(message.payload)) return;
        void store.getState().resetTimer();
        return;
      default: {
        const current = store.getState().blocklist;
        const next = applyBlocklistMutation(current, message);
        // Identity check: an invalid or no-op payload must not persist (one
        // write per accepted mutation, none for a rejected one).
        if (next === current) return;
        store.setState({ blocklist: next });
      }
    }
  };
}
