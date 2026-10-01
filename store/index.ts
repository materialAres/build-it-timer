import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserStorage, createReadOnlyStorage, type BrowserStateStorage } from './storage-adapter';
import { createTimerSlice, type TimerSlice } from './timer.slice';
import { createCitySlice, type CitySlice } from './city.slice';
import { createBlocklistSlice, type BlocklistSlice } from './blocklist.slice';
import { createScoreSlice, type ScoreSlice } from './score.slice';

export type PopupTab = 'timer' | 'city' | 'blocklist' | 'score';

// Volatile slice: derived/transient state (fine-grained countdown, UI state,
// temporary flags). Reset on every context startup and never persisted.
export interface UiSlice {
  readonly ui: {
    readonly activeTab: PopupTab;
    readonly liveRemainingSeconds: number;
    readonly malusAlertVisible: boolean;
  };
}

export type AppState = 
  TimerSlice &
  CitySlice &
  BlocklistSlice &
  ScoreSlice &
  UiSlice;

// Everything except the volatile `ui` slice survives a browser restart.
export type PersistedState = Omit<AppState, keyof UiSlice>;

export const STORE_NAME = 'timer-focus-store';

const initialUiState: UiSlice['ui'] = {
  activeTab: 'timer',
  liveRemainingSeconds: 0,
  malusAlertVisible: false,
};

const createAppState: StateCreator<AppState> = (...args) => ({
  ...createTimerSlice(...args),
  ...createCitySlice(...args),
  ...createBlocklistSlice(...args),
  ...createScoreSlice(...args),
  ui: initialUiState,
});

export const partialize = (state: AppState): PersistedState => ({
  timer: state.timer,
  city: state.city,
  blocklist: state.blocklist,
  score: state.score,
});

export type AppStore = ReturnType<typeof buildStore>;

/**
 * Single-writer ownership (M1.T9). The background service worker is the **only**
 * context allowed to write the persisted store; every other context gets a
 * read-only store.
 *
 * | Slice | Owner | How a non-owner changes it |
 * |---|---|---|
 * | `timer` | background | n/a (driven by alarms in the background) |
 * | `city` | background | n/a (grown/destroyed in the background) |
 * | `score` | background | n/a (computed in the background) |
 * | `blocklist` | background | mutation message (M1.T10) |
 * | `ui` | each context | volatile, never persisted |
 *
 * Without this, two contexts each holding their own in-memory copy of the same
 * persisted key can overwrite each other's changes (last-writer-wins, CI-1).
 * M1.T8 makes them converge; M1.T9 removes the clobbering itself. Read-only
 * contexts keep full read access and still converge through `attachStoreSync`.
 */
export interface CreateAppStoreOptions {
  /** Storage backend; defaults to the writable `browserStorage` (M1.T3). */
  readonly storage?: BrowserStateStorage;
  /** When true, `setState` is never persisted (non-owner context). */
  readonly readOnly?: boolean;
}

export function createAppStore(
  options: CreateAppStoreOptions = {},
): AppStore {
  const { storage = browserStorage, readOnly = false } = options;
  return buildStore(readOnly ? createReadOnlyStorage(storage) : storage);
}

function buildStore(storage: BrowserStateStorage) {
  const store = create<AppState>()(
    persist(createAppState, {
      name: STORE_NAME,
      storage: createJSONStorage<PersistedState>(() => storage),
      partialize,
      version: 1,
    }),
  );
  // Expose the raw adapter so `attachStoreSync` can consult its self-write
  // tracker: `persist.getOptions().storage` only yields the JSON wrapper.
  return Object.assign(store, { rawStorage: storage });
}

// Popup-facing store: read-only, because the background is the single writer
// (M1.T9). The popup reads persisted state and receives updates via
// `attachStoreSync` (M1.T8); it changes configuration by sending mutation
// messages (M1.T10), not by writing the store directly.
export const useAppStore = createAppStore({ readOnly: true });

export const selectUi = (state: UiSlice): UiSlice['ui'] => state.ui;
export const selectActiveTab = (state: UiSlice): PopupTab => state.ui.activeTab;
export const selectLiveRemainingSeconds = (state: UiSlice): number =>
  state.ui.liveRemainingSeconds;

export {
  createTimerSlice,
  selectTimer,
  selectTimerStatus,
  selectRemainingSeconds,
  selectSessionId,
} from './timer.slice';
export { createCitySlice, selectCityLayers, selectCityThemeId } from './city.slice';
export {
  createBlocklistSlice,
  addSiteToList,
  removeSiteFromList,
  upsertTag,
  removeTag,
  selectAllowlist,
  selectBlocklist,
  selectCustomTags,
} from './blocklist.slice';
export type { BlocklistListName, BlocklistState } from './blocklist.slice';
export { createScoreSlice, selectScoreLevel, selectDistractionRatio } from './score.slice';
export type { TimerSlice } from './timer.slice';
export type { CitySlice } from './city.slice';
export type { BlocklistSlice } from './blocklist.slice';
export type { ScoreSlice } from './score.slice';
// Cross-context convergence helper (M1.T8): re-exported here so a context only
// needs to import from `@/store` to both create and sync its store.
export { attachStoreSync, type SyncableStore } from './sync-storage';
