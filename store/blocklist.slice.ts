import type { StateCreator } from 'zustand';
import {
  addBlocklistSite,
  removeBlocklistSite,
} from '@/lib/blocking/blocklist-sites';
import { EMPTY_BLOCKLIST_STATE } from '@/lib/blocking/blocklist-state';
import { PRESETS } from '@/lib/blocking/presets';
import {
  computePresetCoverage,
  isPresetApplied,
  togglePreset,
} from '@/lib/blocking/preset-toggle';
import {
  deleteUserPreset,
  findPreset,
  generatePresetId,
  renameUserPreset,
  saveUserPreset,
} from '@/lib/blocking/saved-presets';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { MessagingDependencies } from '@/lib/messaging/mutation-sender';
import type { BlocklistEntry, BlocklistState, Preset } from './store.types';
import { isBlocklistAddAllowed, isBlocklistEditable } from './blocklist-lock';
import type { AppState } from '.';

export type { BlocklistState } from './store.types';

export interface BlocklistSlice {
  readonly blocklist: BlocklistState;
  /**
   * Add a single site (M3.T3). Normalization (M2.T4/M2.T21) and dedup live in
   * the pure helper; a duplicate or invalid site is a silent no-op (same
   * reference), so nothing is persisted.
   */
  readonly addSite: (site: string) => void;
  /** Remove a single site whatever its sources (M3.T3, CR4). */
  readonly removeSite: (site: string) => void;
  /**
   * Switch a built-in or saved preset on or off (CR4.T3) in a single state
   * update, so the UI never dispatches N mutations. The target state is
   * explicit, not a flip, so a repeated call cannot invert the result.
   */
  readonly togglePreset: (presetId: string, applied: boolean) => void;
  /**
   * Save the current list as a new user preset (CR4.T3). The id is minted from
   * the injected clock/entropy, never in a component, so the UI stays
   * presentational and the id is deterministic under test.
   */
  readonly savePreset: (name: string) => void;
  /** Rename a user preset; built-in presets cannot be renamed. */
  readonly renamePreset: (presetId: string, name: string) => void;
  /** Delete a user preset; its sites stay blocked as manual entries. */
  readonly deletePreset: (presetId: string) => void;
}

/**
 * Collaborators required to change the blocklist from a non-owner context
 * (M1.T10). Injectable (principle D) so the slice stays unit-testable without
 * the message bus; the store barrel supplies the real `sendMessage`.
 */
export interface BlocklistDependencies extends MessagingDependencies {
  /** Clock used to mint preset ids (CR4.T3); injectable for determinism. */
  readonly now?: () => number;
  /** Entropy source for preset ids (CR4.T3); injectable for determinism. */
  readonly random?: () => number;
}

export const createBlocklistSlice =
  (
    dependencies: BlocklistDependencies = {},
  ): StateCreator<AppState, [], [], BlocklistSlice> =>
  (set, get) => {
    // `adds` marks a mutation that can only tighten the list (CR5.T1), the
    // one kind still allowed while a session runs.
    const mutate = (
      message: MutationMessage,
      transform: (state: BlocklistState) => BlocklistState,
      adds = false,
    ): void => {
      applyBlocklistMutation(set, get, dependencies, message, transform, adds);
    };

    return {
      blocklist: EMPTY_BLOCKLIST_STATE,
      addSite(site) {
        mutate(
          { type: 'BLOCKLIST_ADD_SITE', payload: { site } },
          (current) => addBlocklistSite(current, site),
          true,
        );
      },
      removeSite(site) {
        mutate(
          { type: 'BLOCKLIST_REMOVE_SITE', payload: { site } },
          (current) => removeBlocklistSite(current, site),
        );
      },
      togglePreset(presetId, applied) {
        mutate(
          { type: 'PRESET_TOGGLE', payload: { presetId, applied } },
          (current) => {
            const preset = findPreset(current, presetId);
            return preset === undefined
              ? current
              : togglePreset(current, preset, applied);
          },
          applied,
        );
      },
      savePreset(name) {
        const now = dependencies.now ?? Date.now;
        const random = dependencies.random ?? Math.random;
        const id = generatePresetId(now(), random());
        mutate({ type: 'PRESET_SAVE', payload: { id, name } }, (current) =>
          saveUserPreset(current, id, name, PRESETS),
        );
      },
      renamePreset(presetId, name) {
        mutate(
          { type: 'PRESET_RENAME', payload: { presetId, name } },
          (current) => renameUserPreset(current, presetId, name, PRESETS),
        );
      },
      deletePreset(presetId) {
        mutate({ type: 'PRESET_DELETE', payload: { presetId } }, (current) =>
          deleteUserPreset(current, presetId),
        );
      },
    };
  };

/**
 * Shared optimistic-update plumbing (M3.T2): apply the pure transformation,
 * `set` only when something actually changed (identity check, the same no-op
 * discipline as M1.T10/M3.T1) and forward the mutation to the background only
 * in that case. The background is the single writer (M1.T9) and applies the
 * identical transformation.
 */
function applyBlocklistMutation(
  set: (partial: { blocklist: BlocklistState }) => void,
  get: () => AppState,
  dependencies: BlocklistDependencies,
  message: MutationMessage,
  transform: (state: BlocklistState) => BlocklistState,
  adds: boolean,
): void {
  // CR2.T1: the lock is checked before anything else, so a locked mutation is a
  // no-op even for an input that would otherwise be valid. CR5.T1: a mutation
  // that only adds sites has the wider window.
  const status = get().timer.status;
  if (!(adds ? isBlocklistAddAllowed(status) : isBlocklistEditable(status))) {
    return;
  }
  const current = get().blocklist;
  const next = transform(current);
  if (next === current) return;
  set({ blocklist: next });
  dependencies.sendMutation?.(message);
}

export const selectBlocklist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.blocklist;

export const selectAppliedPresetIds = (
  state: BlocklistSlice,
): ReadonlyArray<string> => state.blocklist.appliedPresetIds;

export const selectUserPresets = (
  state: BlocklistSlice,
): ReadonlyArray<Preset> => state.blocklist.userPresets;

/** Whether a preset is on — a primitive, so the selector never re-renders alone. */
export const selectIsPresetApplied =
  (presetId: string) =>
  (state: BlocklistSlice): boolean =>
    isPresetApplied(state.blocklist, presetId);

/** How many of a preset's domains the list carries as its own (the "3/4" count). */
export const selectPresetCoveredCount =
  (preset: Preset) =>
  (state: BlocklistSlice): number =>
    computePresetCoverage(state.blocklist, preset).covered;
