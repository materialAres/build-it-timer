import type { AppStore } from '@/store';
import { getPresetById } from '@/lib/blocking/presets';
import { isPresetDurationSeconds } from '@/lib/timer/focus-presets';
import {
  addBlocklistSite,
  addPresetToBlocklist,
  assignTagToSite,
  unassignTagFromSite,
  removeBlocklistSite,
  upsertTag,
  removeTag,
  type BlocklistState,
} from '@/store';
import type { MutationMessage } from './messages.types';
import type { Tag } from '@/store/store.types';

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
 * The handler addresses the single blocklist (CR1.T2/CR1.T5a); an extra `list`
 * field in a received payload has no effect.
 *
 * The semantics stay deliberately minimal here: normalization (M2.T4/M2.T21),
 * dedup, preset expansion (M2.T5) and the DNR side-effect (M2.T7) are owned by
 * those tasks.
 */
function applyBlocklistMutation(
  state: BlocklistState,
  message: MutationMessage,
): BlocklistState {
  switch (message.type) {
    case 'BLOCKLIST_ADD_SITE': {
      const { site } = message.payload;
      if (typeof site !== 'string' || site.length === 0) return state;
      return addBlocklistSite(state, site);
    }
    case 'BLOCKLIST_REMOVE_SITE': {
      const { site } = message.payload;
      if (typeof site !== 'string' || site.length === 0) return state;
      return removeBlocklistSite(state, site);
    }
    case 'BLOCKLIST_APPLY_PRESET': {
      const { presetId } = message.payload;
      if (typeof presetId !== 'string' || presetId.length === 0) return state;
      const preset = getPresetById(presetId);
      if (preset === undefined) return state;
      // The whole preset is expanded in a single state update (M3.T1), so the
      // mutation persists once no matter how many domains it contains.
      return addPresetToBlocklist(state, preset);
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
      const { site, tagId } = message.payload;
      if (typeof site !== 'string' || typeof tagId !== 'string') {
        return state;
      }
      return assignTagToSite(state, site, tagId);
    }
    case 'TAG_UNASSIGN': {
      const { site, tagId } = message.payload;
      if (typeof site !== 'string' || typeof tagId !== 'string') {
        return state;
      }
      return unassignTagFromSite(state, site, tagId);
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
      case 'TIMER_SET_DURATION': {
        const { durationSeconds } = message.payload;
        // Untrusted payload (M5.T1): a whole number that is one of the offered
        // presets. `setFocusDuration` also no-ops outside idle/completed.
        if (
          !Number.isInteger(durationSeconds) ||
          !isPresetDurationSeconds(durationSeconds)
        ) {
          return;
        }
        store.getState().setFocusDuration(durationSeconds);
        return;
      }
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
