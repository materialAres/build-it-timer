import type { StateCreator } from 'zustand';
import type { CityGrid, CityLayers } from '@/components/city/city.types';
import type { AppState } from '.';

export const DEFAULT_CITY_WIDTH = 40;
export const DEFAULT_CITY_HEIGHT = 12;

export interface CitySlice {
  readonly city: {
    readonly layers: CityLayers;
    readonly themeId: string | null;
    readonly sessionId: string | null;
  };
}

function createEmptyGrid(width: number, height: number): CityGrid {
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): { char: null } => ({ char: null })),
  );
  return { width, height, cells };
}

function createEmptyLayers(): CityLayers {
  return {
    background: createEmptyGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
    middleground: createEmptyGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
    foreground: createEmptyGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
  };
}

export const createCitySlice: StateCreator<AppState, [], [], CitySlice> = () => ({
  city: { layers: createEmptyLayers(), themeId: null, sessionId: null },
});

export const selectCityLayers = (state: CitySlice): CityLayers => state.city.layers;

export const selectCityThemeId = (state: CitySlice): string | null =>
  state.city.themeId;
