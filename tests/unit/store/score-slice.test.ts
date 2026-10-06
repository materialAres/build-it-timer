import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  selectScoreLevel,
  selectDistractionRatio,
  selectPopulation,
} from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

describe('scoreSlice (M2.T9)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({ dependencies: { alarmProvider: new FakeAlarmProvider() } });

  it('starts at excellent with a zero distraction ratio', () => {
    const { score } = createStore().getState();

    expect(score.level).toBe('excellent');
    expect(score.distractionRatio).toBe(0);
    expect(score.population).toBe(0);
  });

  it('derives the level from the ratio through the pure threshold function', () => {
    const store = createStore();

    store.getState().setDistractionRatio(0.1);
    expect(store.getState().score).toEqual({
      level: 'good',
      distractionRatio: 0.1,
      population: 0,
    });

    store.getState().setDistractionRatio(0.5);
    expect(store.getState().score).toEqual({
      level: 'bad',
      distractionRatio: 0.5,
      population: 0,
    });

    store.getState().setDistractionRatio(0);
    expect(store.getState().score).toEqual({
      level: 'excellent',
      distractionRatio: 0,
      population: 0,
    });
  });

  it('follows the exact good/bad boundary', () => {
    const store = createStore();

    store.getState().setDistractionRatio(0.3);
    expect(store.getState().score.level).toBe('good');

    store.getState().setDistractionRatio(0.31);
    expect(store.getState().score.level).toBe('bad');
  });

  it('exposes granular selectors over the score slice', () => {
    const store = createStore();
    store.getState().setDistractionRatio(0.42);

    expect(selectScoreLevel(store.getState())).toBe('bad');
    expect(selectDistractionRatio(store.getState())).toBe(0.42);
  });

  it('stores the session population and exposes it through a selector (M2.T18)', () => {
    const store = createStore();

    expect(selectPopulation(store.getState())).toBe(0);

    store.getState().setPopulation(35);
    expect(store.getState().score.population).toBe(35);
    expect(selectPopulation(store.getState())).toBe(35);
  });

  it('updating the population does not disturb the level or the ratio', () => {
    const store = createStore();
    store.getState().setDistractionRatio(0.5);

    store.getState().setPopulation(20);

    expect(store.getState().score).toEqual({
      level: 'bad',
      distractionRatio: 0.5,
      population: 20,
    });
  });

  it('defensively normalizes a non-finite or negative population', () => {
    const store = createStore();

    store.getState().setPopulation(Number.NaN);
    expect(store.getState().score.population).toBe(0);

    store.getState().setPopulation(-10);
    expect(store.getState().score.population).toBe(0);

    store.getState().setPopulation(12.9);
    expect(store.getState().score.population).toBe(12);
  });
});
