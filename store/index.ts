import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserStorage, type BrowserStateStorage } from './storage-adapter';
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

export type AppState = TimerSlice &
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

const createAppState: StateCreator<AppState, [], []> = (...args) => ({
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

export function createAppStore(
  storage: BrowserStateStorage = browserStorage,
): AppStore {
  return buildStore(storage);
}

function buildStore(storage: BrowserStateStorage) {
  return create<AppState>()(
    persist(createAppState, {
      name: STORE_NAME,
      storage: createJSONStorage<PersistedState>(() => storage),
      partialize,
      version: 1,
    }),
  );
}

// Single shared hook used by the popup and the background.
export const useAppStore = createAppStore();

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
  selectAllowlist,
  selectBlocklist,
  selectCustomTags,
} from './blocklist.slice';
export { createScoreSlice, selectScoreLevel, selectDistractionRatio } from './score.slice';
export type { TimerSlice } from './timer.slice';
export type { CitySlice } from './city.slice';
export type { BlocklistSlice } from './blocklist.slice';
export type { ScoreSlice } from './score.slice';
