import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, selectScoreLevel, selectPopulation } from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

describe('scoreSlice (M2.T9, CR3)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({ dependencies: { alarmProvider: new FakeAlarmProvider() } });

  it('starts at bad with no characters and no population', () => {
    expect(createStore().getState().score).toEqual({
      builtCharacters: 0,
      level: 'bad',
      population: 0,
    });
  });

  it.each([
    [0, 'bad', 0],
    [179, 'bad', 895],
    [180, 'good', 900],
    [420, 'great', 3300],
    [599, 'great', 6880],
    [600, 'excellent', 7383],
  ])(
    'derives the level and the population from %i built characters',
    (built, level, population) => {
      const store = createStore();

      store.getState().setBuiltCharacters(built);

      expect(store.getState().score).toEqual({
        builtCharacters: built,
        level,
        population,
      });
    },
  );

  it('drops back to a lower level when characters are taken away', () => {
    const store = createStore();
    store.getState().setBuiltCharacters(420);
    expect(store.getState().score.level).toBe('great');

    store.getState().setBuiltCharacters(419);
    expect(store.getState().score.level).toBe('good');
  });

  it('exposes granular selectors over the score slice', () => {
    const store = createStore();
    store.getState().setBuiltCharacters(181);

    expect(selectScoreLevel(store.getState())).toBe('good');
    expect(selectPopulation(store.getState())).toBe(910);
  });

  it('defensively normalizes a non-finite, negative or fractional count', () => {
    const store = createStore();

    store.getState().setBuiltCharacters(Number.NaN);
    expect(store.getState().score.builtCharacters).toBe(0);

    store.getState().setBuiltCharacters(-10);
    expect(store.getState().score.builtCharacters).toBe(0);

    store.getState().setBuiltCharacters(Number.POSITIVE_INFINITY);
    expect(store.getState().score.builtCharacters).toBe(0);

    store.getState().setBuiltCharacters(180.9);
    expect(store.getState().score.builtCharacters).toBe(180);
    expect(store.getState().score.level).toBe('good');
  });

  it('no longer exposes the removed distraction-ratio and population actions', () => {
    const state = createStore().getState() as unknown as Record<string, unknown>;

    expect(state['setDistractionRatio']).toBeUndefined();
    expect(state['setPopulation']).toBeUndefined();
  });
});
