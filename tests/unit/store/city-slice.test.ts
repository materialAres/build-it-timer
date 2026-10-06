import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  DEFAULT_CITY_HEIGHT,
  DEFAULT_CITY_WIDTH,
  DEFAULT_THEME_ID,
  identityGrowthEngine,
  selectCity,
  selectCityBuildings,
  selectCityLayers,
  selectCitySessionId,
  selectCityThemeId,
  type CityGrowthEngine,
  type StoreDependencies,
} from '@/store';
import type { CityLayers } from '@/components/city/city.types';
import { seedFromSession } from '@/lib/city/growth-engine';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

const START_MS = 1_700_000_000_000;

/** Place a single occupied cell in an otherwise empty city (test fixture). */
function withCharacterAt(layers: CityLayers, row: number, col: number): CityLayers {
  return {
    ...layers,
    background: {
      ...layers.background,
      cells: layers.background.cells.map((line, r) =>
        r !== row ? line : line.map((cell, c) => (c !== col ? cell : { char: '#' })),
      ),
    },
  };
}

describe('citySlice (M2.T11)', () => {
  let alarmProvider: FakeAlarmProvider;
  let growthEngine: CityGrowthEngine;
  let selectThemeId: (sessionId: string) => string;

  const createStore = (
    overrides: Partial<StoreDependencies> = {},
  ): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: {
        alarmProvider,
        now: () => START_MS,
        random: () => 0.5,
        growthEngine,
        selectThemeId,
        width: DEFAULT_CITY_WIDTH,
        height: DEFAULT_CITY_HEIGHT,
        ...overrides,
      },
    });

  beforeEach(() => {
    fakeBrowser.reset();
    alarmProvider = new FakeAlarmProvider(START_MS);
    growthEngine = vi.fn(identityGrowthEngine);
    selectThemeId = vi.fn(() => 'theme-from-registry');
  });

  it('starts with three empty layers, no buildings and no session', () => {
    const { city } = createStore().getState();

    expect(city.layers.background.width).toBe(DEFAULT_CITY_WIDTH);
    expect(city.layers.background.height).toBe(DEFAULT_CITY_HEIGHT);
    for (const layer of [city.layers.background, city.layers.middleground, city.layers.foreground]) {
      const occupied = layer.cells.flat().filter((cell) => cell.char !== null);
      expect(occupied).toEqual([]);
    }
    expect(city.buildings).toEqual({});
    expect(city.themeId).toBeNull();
    expect(city.sessionId).toBeNull();
  });

  it('builds the empty layers with the configured dimensions', () => {
    const { city } = createStore({ width: 8, height: 3 }).getState();

    expect(city.layers.background.width).toBe(8);
    expect(city.layers.background.height).toBe(3);
    expect(city.layers.middleground.cells).toHaveLength(3);
    expect(city.layers.foreground.cells[0]).toHaveLength(8);
  });

  it('resetCityForNewSession clears layers and buildings and assigns the theme and session', () => {
    const store = createStore();
    store.setState({
      city: {
        ...store.getState().city,
        layers: withCharacterAt(store.getState().city.layers, 0, 0),
        buildings: {
          'facebook.com': {
            domain: 'facebook.com',
            layer: 'background',
            topRow: 0,
            leftCol: 0,
            widthChars: 3,
          },
        },
        themeId: 'old-theme',
        sessionId: 'old-session',
      },
    });

    store.getState().resetCityForNewSession('session-1', 'theme-1');

    const { city } = store.getState();
    expect(city.layers.background.cells.flat().every((cell) => cell.char === null)).toBe(true);
    expect(city.buildings).toEqual({});
    expect(city.themeId).toBe('theme-1');
    expect(city.sessionId).toBe('session-1');
  });

  it('resetCityForNewSession picks the theme through the injected picker by default', () => {
    const store = createStore();

    store.getState().resetCityForNewSession('session-2');

    expect(selectThemeId).toHaveBeenCalledWith('session-2');
    expect(store.getState().city.themeId).toBe('theme-from-registry');
  });

  it('growCity delegates to the injected engine without computing internally', () => {
    growthEngine = vi.fn((layers: CityLayers) => withCharacterAt(layers, 0, 0));
    const store = createStore();
    const before = store.getState().city.layers;

    store.getState().growCity(2_000);

    expect(growthEngine).toHaveBeenCalledWith(before, 2_000, seedFromSession(null));
    expect(store.getState().city.layers).not.toBe(before);
    expect(store.getState().city.layers.background.cells[0]?.[0]?.char).toBe('#');
  });

  it('growCity skips the write when the engine returns the same reference', () => {
    const store = createStore();
    const before = store.getState().city;
    const setState = vi.spyOn(store, 'setState');

    store.getState().growCity(0);

    expect(growthEngine).toHaveBeenCalledWith(before.layers, 0, seedFromSession(null));
    expect(setState).not.toHaveBeenCalled();
    expect(store.getState().city).toBe(before);
  });

  it('applyMalusToCity delegates to applyMalus, removing one character per tick', () => {
    const store = createStore();
    store.setState({
      city: { ...store.getState().city, layers: withCharacterAt(store.getState().city.layers, 0, 0) },
    });

    store.getState().applyMalusToCity(1);

    const cell = store.getState().city.layers.background.cells[0]?.[0];
    expect(cell?.char).toBeNull();
  });

  it('applyMalusToCity on an already empty city is a safe no-op', () => {
    const store = createStore();
    const before = store.getState().city;

    store.getState().applyMalusToCity(5);

    expect(store.getState().city).toBe(before);
  });

  it('applyMalusToCity tolerates non-finite and negative ticks without crashing', () => {
    const store = createStore();
    const before = store.getState().city;

    store.getState().applyMalusToCity(Number.NaN);
    store.getState().applyMalusToCity(-3);
    store.getState().applyMalusToCity(Number.POSITIVE_INFINITY);

    expect(store.getState().city).toBe(before);
  });

  it('startTimer starts a brand-new city for the new session', async () => {
    const store = createStore();
    store.setState({
      city: { ...store.getState().city, layers: withCharacterAt(store.getState().city.layers, 0, 0) },
    });

    await store.getState().startTimer();

    const { city, timer } = store.getState();
    expect(city.sessionId).toBe(timer.sessionId);
    expect(city.themeId).toBe('theme-from-registry');
    expect(city.layers.background.cells.flat().every((cell) => cell.char === null)).toBe(true);
  });

  it('resuming a paused session keeps the city already built', async () => {
    const store = createStore();
    await store.getState().startTimer();
    store.setState({
      city: { ...store.getState().city, layers: withCharacterAt(store.getState().city.layers, 0, 0) },
    });
    const built = store.getState().city;

    await store.getState().pauseTimer();
    await store.getState().startTimer();

    expect(store.getState().city).toBe(built);
  });

  it('exposes granular city selectors', () => {
    const store = createStore();
    const state = store.getState();

    expect(selectCity(state)).toBe(state.city);
    expect(selectCityLayers(state)).toBe(state.city.layers);
    expect(selectCityBuildings(state)).toEqual({});
    expect(selectCityThemeId(state)).toBeNull();
    expect(selectCitySessionId(state)).toBeNull();
    expect(DEFAULT_THEME_ID).toBe('default');
  });
});
