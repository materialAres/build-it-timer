import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  selectCity,
  selectCityPlan,
  selectCitySessionId,
} from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

const START_MS = 1_700_000_000_000;

describe('citySlice (M2.T11, CR6.T9a)', () => {
  let alarmProvider: FakeAlarmProvider;

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: { alarmProvider, now: () => START_MS, random: () => 0.5 },
    });

  beforeEach(() => {
    fakeBrowser.reset();
    alarmProvider = new FakeAlarmProvider(START_MS);
  });

  it('starts with no session and so no plan', () => {
    const state = createStore().getState();

    expect(state.city).toEqual({ sessionId: null });
    expect(selectCityPlan(state)).toBeNull();
  });

  it('holds only the session id: no grid, layers, buildings or theme', () => {
    const store = createStore();
    store.getState().resetCityForNewSession('session-shape');

    expect(Object.keys(store.getState().city)).toEqual(['sessionId']);
  });

  it('resetCityForNewSession assigns the session and so a new plan', () => {
    const store = createStore();
    store.getState().resetCityForNewSession('session-1');
    const first = selectCityPlan(store.getState());
    store.getState().resetCityForNewSession('session-2');
    const second = selectCityPlan(store.getState());

    expect(store.getState().city.sessionId).toBe('session-2');
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('gives the same plan for the same session id', () => {
    const store = createStore();
    store.getState().resetCityForNewSession('session-same');
    const a = selectCityPlan(store.getState());
    store.getState().resetCityForNewSession('session-same');
    expect(selectCityPlan(store.getState())).toBe(a);
  });

  it('startTimer starts a brand-new city for the new session', async () => {
    const store = createStore();

    await store.getState().startTimer();

    const { city, timer } = store.getState();
    expect(city.sessionId).toBe(timer.sessionId);
    expect(city.sessionId).not.toBeNull();
  });

  it('resuming a paused session keeps the city already built', async () => {
    const store = createStore();
    await store.getState().startTimer();
    const built = store.getState().city;

    await store.getState().pauseTimer();
    await store.getState().startTimer();

    expect(store.getState().city).toBe(built);
  });

  it('exposes granular city selectors', () => {
    const state = createStore().getState();

    expect(selectCity(state)).toBe(state.city);
    expect(selectCitySessionId(state)).toBeNull();
  });
});
