import type { StateCreator } from 'zustand';
import { applyMalus } from '@/lib/score/apply-malus';
import type {
  BuildingMeta,
  CityGrid,
  CityLayers,
} from '@/components/city/city.types';
import type { AppState } from '.';

export const DEFAULT_CITY_WIDTH = 40;
export const DEFAULT_CITY_HEIGHT = 12;

/**
 * The default theme id now lives in the theme registry (M2.T13b); re-exported
 * here so existing imports from the store barrel keep working. The id assigned
 * to a new session comes from the injected `selectThemeId` (the registry's
 * `selectThemeId` in production).
 */
export { DEFAULT_THEME_ID } from '@/lib/city/theme-registry';

/**
 * The growth engine port (principle D): the pure function that computes the new
 * layer state from the current one and an elapsed focus time. Injected so the
 * slice stays a thin delegation layer and the concrete engine
 * (`lib/city/growth-engine.ts`, M2.T12) can be plugged in from the outside.
 * The default is the identity, i.e. "no growth engine wired yet": a no-op that
 * keeps the slice fully usable and testable.
 */
export type CityGrowthEngine = (layers: CityLayers, elapsedMs: number) => CityLayers;

export const identityGrowthEngine: CityGrowthEngine = (layers) => layers;

/** Collaborators of the city slice, injected through `createAppStore`. */
export interface CityDependencies {
  readonly growthEngine: CityGrowthEngine;
  /** Picks the theme id for a brand-new session (theme registry, M2.T13b). */
  readonly selectThemeId: (sessionId: string) => string;
  /** Layer dimensions of a fresh city (configurable for tests). */
  readonly width: number;
  readonly height: number;
}

export interface CityState {
  readonly layers: CityLayers;
  readonly buildings: Readonly<Record<string, BuildingMeta>>;
  readonly themeId: string | null;
  readonly sessionId: string | null;
}

export interface CitySlice {
  readonly city: CityState;
  /**
   * Start a brand-new city for a fresh focus session (roadmap M2.T11): the
   * three layers are reset to empty, the previously tracked buildings are
   * dropped and a new theme is assigned. Invoked by `startTimer()` (M2.T1) on
   * the `idle → running` transition, never on a resume, so each session builds
   * its own city.
   */
  resetCityForNewSession(sessionId: string, themeId?: string): void;
  /** Grow the city by delegating to the injected growth engine (M2.T12). */
  growCity(elapsedMs: number): void;
  /** Shrink the city by delegating to the malus function (M2.T10). */
  applyMalusToCity(ticks: number): void;
}

function createEmptyGrid(width: number, height: number): CityGrid {
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): { char: null } => ({ char: null })),
  );
  return { width, height, cells };
}

function createEmptyLayers(width: number, height: number): CityLayers {
  return {
    background: createEmptyGrid(width, height),
    middleground: createEmptyGrid(width, height),
    foreground: createEmptyGrid(width, height),
  };
}

/**
 * City state for the current, in-progress session (roadmap M2.T11). The slice
 * computes nothing: growth and destruction are delegated to the pure modules
 * (`growth-engine.ts` M2.T12, `apply-malus.ts` M2.T10) so they stay testable in
 * isolation (principle S/D).
 */
export function createCitySlice(
  dependencies: CityDependencies,
): StateCreator<AppState, [], [], CitySlice> {
  const { growthEngine, selectThemeId, width, height } = dependencies;

  return (set, get) => ({
    city: {
      layers: createEmptyLayers(width, height),
      buildings: {},
      themeId: null,
      sessionId: null,
    },

    resetCityForNewSession(sessionId: string, themeId = selectThemeId(sessionId)): void {
      set({
        city: {
          layers: createEmptyLayers(width, height),
          buildings: {},
          themeId,
          sessionId,
        },
      });
    },

    growCity(elapsedMs: number): void {
      const { city } = get();
      const layers = growthEngine(city.layers, elapsedMs);
      // Same reference means the engine computed no change: skip the write so a
      // no-op tick does not persist/re-render (same identity pattern as M1.T10).
      if (layers !== city.layers) set({ city: { ...city, layers } });
    },

    applyMalusToCity(ticks: number): void {
      const { city } = get();
      const layers = applyMalus(city.layers, ticks);
      if (layers !== city.layers) set({ city: { ...city, layers } });
    },
  });
}

export const selectCity = (state: CitySlice): CityState => state.city;

export const selectCityLayers = (state: CitySlice): CityLayers => state.city.layers;

export const selectCityBuildings = (
  state: CitySlice,
): Readonly<Record<string, BuildingMeta>> => state.city.buildings;

export const selectCityThemeId = (state: CitySlice): string | null =>
  state.city.themeId;

export const selectCitySessionId = (state: CitySlice): string | null =>
  state.city.sessionId;
