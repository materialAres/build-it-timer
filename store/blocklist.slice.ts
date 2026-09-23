import type { StateCreator } from 'zustand';
import type { BlocklistEntry, Tag } from './store.types';
import type { AppState } from '.';

export interface BlocklistSlice {
  readonly blocklist: {
    readonly allowlist: ReadonlyArray<BlocklistEntry>;
    readonly blocklist: ReadonlyArray<BlocklistEntry>;
    readonly customTags: ReadonlyArray<Tag>;
  };
}

export const createBlocklistSlice: StateCreator<AppState, [], [], BlocklistSlice> =
  () => ({
    blocklist: { allowlist: [], blocklist: [], customTags: [] },
  });

export const selectAllowlist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.allowlist;

export const selectBlocklist = (
  state: BlocklistSlice,
): ReadonlyArray<BlocklistEntry> => state.blocklist.blocklist;

export const selectCustomTags = (state: BlocklistSlice): ReadonlyArray<Tag> =>
  state.blocklist.customTags;
