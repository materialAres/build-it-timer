import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createBrowserAlarmProvider } from '@/lib/timer/alarm-adapter';
import { selectThemeId } from '@/lib/city/theme-registry';
import { growCityByTicks } from '@/lib/city/growth-engine';
import { browserStorage, createReadOnlyStorage, type BrowserStateStorage } from './storage-adapter';
import { createTimerSlice, type TimerDependencies, type TimerSlice } from './timer.slice';
import type { TimerState } from './store.types';
import {
  createCitySlice,
  DEFAULT_CITY_HEIGHT,
  DEFAULT_CITY_WIDTH,
  type CityDependencies,
  type CitySlice,
} from './city.slice';
import { sendMessage } from '@/lib/messaging/bus';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import {
  migrateBlocklistState,
  sanitizeBlocklistState,
  type EffectiveBlocklist,
} from '@/lib/blocking/legacy-blocklist';
import { createLogger, type Logger } from '@/utils/logger';
import {
  createBlocklistSlice,
  type BlocklistDependencies,
  type BlocklistSlice,
} from './blocklist.slice';
import { createScoreSlice, type ScoreSlice } from './score.slice';
import { createSessionHistorySlice, type SessionHistorySlice } from './session-history.slice';
export type PopupTab = 'timer' | 'city' | 'blocklist' | 'score';

// Volatile slice: derived/transient state (fine-grained countdown, UI state,
// temporary flags). Reset on every context startup and never persisted.
export interface UiSlice {
  readonly ui: {
    readonly activeTab: PopupTab;
    readonly liveRemainingSeconds: number;
  };
  /**
   * Switch the visible popup section (M3.T4). The field is volatile, so the
   * popup always opens on the default tab; the action writes only the in-memory
   * state, which is why a read-only context (the popup, M1.T9) may call it —
   * `ui` is never persisted, so the single-writer rule is not involved.
   */
  setActiveTab(tab: PopupTab): void;
  /**
   * Publish the popup-side countdown estimate (I001). The value is derived from
   * the session's end time by the pure `estimateRemainingSeconds` and written
   * here so `TimerDisplay` can read it through a granular selector; the field is
   * volatile, so this is a local write even in a read-only context.
   */
  setLiveRemainingSeconds(seconds: number): void;
}

export type AppState = 
  TimerSlice &
  CitySlice &
  BlocklistSlice &
  ScoreSlice &
  SessionHistorySlice &
  UiSlice;

// The persisted payload: the data of the persisted slices only. The action
// functions are excluded (they are recreated on every store creation and have
// nothing to persist) and so is the volatile `ui` slice. Declared explicitly so
// adding an action to a slice never widens what ends up in storage.
export interface PersistedState {
  readonly timer: TimerState;
  readonly city: CitySlice['city'];
  /**
   * The single-list shape (CR1.T3). The in-memory `blocklist` slice still
   * carries an (always empty) `allowlist` field until CR1.T5, but it is not
   * persisted anymore.
   */
  readonly blocklist: EffectiveBlocklist;
  readonly score: ScoreSlice['score'];
  readonly sessionHistory: SessionHistorySlice['sessionHistory'];
}

export const STORE_NAME = 'timer-focus-store';

const initialUiState: UiSlice['ui'] = {
  activeTab: 'timer',
  liveRemainingSeconds: 0,
};

// Collaborators the slices need to act (principle D). Injected through
// `createAppStore` so a test can substitute a fake alarm provider, growth
// engine, theme picker and a deterministic clock/entropy source without
// touching the browser APIs. The timer slice (M2.T1) and the city slice
// (M2.T11) share this object; later slices extend it.
export type StoreDependencies = TimerDependencies & CityDependencies & BlocklistDependencies;
const defaultDependencies = (): StoreDependencies => ({
  alarmProvider: createBrowserAlarmProvider(),
  now: Date.now,
  random: Math.random,
  // The concrete, session-seeded growth engine (M2.T12/M2.T15): `growCityByTicks`
  // receives the whole ticks the background derived from the elapsed focus time
  // and the session cadence, so the running app actually builds a city instead
  // of the placeholder identity.
  growthEngine: growCityByTicks,
  // Each session gets a deterministic biome from the theme registry (M2.T13b),
  // replacing the placeholder fixed default.
  selectThemeId,
  width: DEFAULT_CITY_WIDTH,
  height: DEFAULT_CITY_HEIGHT,
  // A read-only context changes configuration only by asking the background
  // (M1.T9/M1.T10); the popup-facing `applyPreset` (M3.T1) and the timer
  // commands (M3.T3b) both use this sender.
  sendMutation: (message: MutationMessage): void => {
    void sendMessage(message);
  },
});

const createAppState =
  (dependencies: StoreDependencies): StateCreator<AppState> =>
  (set, get, ...rest) => ({
    ...createTimerSlice(dependencies)(set, get, ...rest),
    ...createCitySlice(dependencies)(set, get, ...rest),
    ...createBlocklistSlice(dependencies)(set, get, ...rest),
    ...createScoreSlice(set, get, ...rest),
    ...createSessionHistorySlice(set, get, ...rest),
    ui: initialUiState,
    setActiveTab(tab: PopupTab): void {
      set({ ui: { ...get().ui, activeTab: tab } });
    },
    setLiveRemainingSeconds(seconds: number): void {
      // Guard the untrusted boundary (§1.4): a non-finite estimate would leak
      // `NaN` into the rendered countdown.
      const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
      const { ui } = get();
      if (ui.liveRemainingSeconds === safe) return;
      set({ ui: { ...ui, liveRemainingSeconds: safe } });
    },
  });

export const partialize = (state: AppState): PersistedState => ({
  timer: state.timer,
  city: state.city,
  blocklist: {
    blocklist: state.blocklist.blocklist,
    customTags: state.blocklist.customTags,
  },
  score: state.score,
  sessionHistory: state.sessionHistory,
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
 * | `sessionHistory` | background | n/a (recorded at session end) |
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
  /** Logger for rehydration diagnostics (M4.T3c); defaults to scope `store`. */
  readonly logger?: Logger;
  /**
   * Slice collaborators (M2.T1). Defaults to the real `browser.alarms` provider
   * with the system clock and `Math.random`; tests inject fakes instead.
   */
  readonly dependencies?: Partial<StoreDependencies>;
}

export function createAppStore(
  options: CreateAppStoreOptions = {},
): AppStore {
  const { storage = browserStorage, readOnly = false, dependencies } = options;
  const resolved = { ...defaultDependencies(), ...dependencies };
  const logger = options.logger ?? createLogger('store');
  return buildStore(
    readOnly ? createReadOnlyStorage(storage) : storage,
    resolved,
    logger,
  );
}

/**
 * Keep rehydration diagnostics useful without echoing user data. V8's
 * `JSON.parse` error can quote a prefix of the malformed input, and the
 * persisted store contains the blocklist (user domains), so a bare
 * `SyntaxError` must not reach the log verbatim.
 */
function sanitizeRehydrationError(error: unknown): unknown {
  if (error instanceof SyntaxError) {
    return new Error('persisted store JSON is malformed');
  }
  return error;
}

function buildStore(
  storage: BrowserStateStorage,
  dependencies: StoreDependencies,
  logger: Logger,
) {
  const store = create<AppState>()(
    persist(createAppState(dependencies), {
      name: STORE_NAME,
      storage: createJSONStorage<PersistedState>(() => storage),
      partialize,
      // Slice-aware `merge` (store-analysis CI-2). Without it zustand's shallow
      // merge drops any *newly added* field that a persisted snapshot predates,
      // so `timer.durationSeconds` would come back `undefined` for an existing
      // user. Merging per slice keeps the fresh default in that case.
      //
      // A slice that was *not* persisted keeps its current reference: rebuilding
      // it every hydration would churn references the app already observes
      // (breaking `selectCity`-style identity checks) and could clobber state
      // written between store creation and the async hydration completing.
      // Version 2 (CR1.T3): the persisted blocklist is the single-list shape
      // `{ blocklist, customTags }`. Version-1 payloads carry the legacy
      // `{ allowlist, blocklist, customTags }` and are migrated on read.
      version: 2,
      migrate: (persistedState: unknown, version: number): PersistedState => {
        const saved =
          typeof persistedState === 'object' && persistedState !== null
            ? (persistedState as Partial<PersistedState> & { blocklist?: unknown })
            : {};
        // zustand calls `migrate` only on a version mismatch, so a version-2
        // payload is already in the current shape. `merge` sanitizes it anyway.
        if (version >= 2) return saved as PersistedState;
        return {
          ...saved,
          blocklist: migrateBlocklistState(saved.blocklist),
        } as PersistedState;
      },
      // CI-3 (M4.T3c): zustand consumes rehydration failures and keeps the
      // defaults, which is the right behaviour but used to leave no trace. Log
      // the key and the error; never the raw persisted string or the parsed
      // state (it can contain user domains).
      onRehydrateStorage: () => (_state, error) => {
        if (error === undefined) return;
        logger.error('store rehydration failed', sanitizeRehydrationError(error), {
          key: STORE_NAME,
        });
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedState>;
        return {
          ...current,
          ...saved,
          timer: saved.timer ? { ...current.timer, ...saved.timer } : current.timer,
          city: saved.city ? { ...current.city, ...saved.city } : current.city,
          blocklist: saved.blocklist
            ? { ...current.blocklist, ...sanitizeBlocklistState(saved.blocklist) }
            : current.blocklist,
          score: saved.score ? { ...current.score, ...saved.score } : current.score,
          sessionHistory: saved.sessionHistory
            ? { ...current.sessionHistory, ...saved.sessionHistory }
            : current.sessionHistory,
        };
      },
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
  DEFAULT_FOCUS_SECONDS,
  selectTimer,
  selectTimerStatus,
  selectRemainingSeconds,
  selectSessionId,
} from './timer.slice';
export type { TimerDependencies } from './timer.slice';
export {
  createCitySlice,
  DEFAULT_CITY_HEIGHT,
  DEFAULT_CITY_WIDTH,
  DEFAULT_THEME_ID,
  identityGrowthEngine,
  selectCity,
  selectCityBuildings,
  selectCityLayers,
  selectCitySessionId,
  selectCityThemeId,
} from './city.slice';
export type {
  CityDependencies,
  CityGrowthEngine,
  CityState,
} from './city.slice';
export {
  createBlocklistSlice,
  addSiteToList,
  addPresetToList,
  assignTagToSite,
  unassignTagFromSite,
  filterEntriesByTag,
  generateTagId,
  hasTagLabel,
  removeSiteFromList,
  resolveListConflicts,
  upsertTag,
  removeTag,
  selectAllowlist,
  selectBlocklist,
  selectCustomTags,
} from './blocklist.slice';
export type {
  BlocklistDependencies,
  BlocklistListName,
  BlocklistState,
} from './blocklist.slice';
export {
  createSessionHistorySlice,
  appendSessionSummary,
  MAX_SESSION_HISTORY,
  selectSessionHistory,
  selectSessionHistoryState,
} from './session-history.slice';
export type {
  SessionHistorySlice,
  SessionHistoryState,
} from './session-history.slice';
export {
  createScoreSlice,
  selectScoreLevel,
  selectDistractionRatio,
  selectPopulation,
} from './score.slice';
export type { TimerSlice } from './timer.slice';
export type { CitySlice } from './city.slice';
export type { BlocklistSlice } from './blocklist.slice';
export type { ScoreSlice } from './score.slice';
// Cross-context convergence helper (M1.T8): re-exported here so a context only
// needs to import from `@/store` to both create and sync its store.
export { attachStoreSync, type SyncableStore } from './sync-storage';
