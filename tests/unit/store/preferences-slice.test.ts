import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  selectSoundEnabled,
  selectSoundThemeId,
  selectSoundVolume,
} from '@/store';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { TimerStatus } from '@/store/store.types';
import { DEFAULT_SOUND_PREFERENCES } from '@/lib/sound/sound-preferences';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

describe('preferencesSlice (M5.T6)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: { alarmProvider: new FakeAlarmProvider() },
    });

  it('starts with the default sound preferences', () => {
    const state = createStore().getState();
    expect(state.preferences.sound).toEqual(DEFAULT_SOUND_PREFERENCES);
  });

  it('exposes one granular selector per field', () => {
    const store = createStore();
    store.getState().setSoundPreferences({
      enabled: false,
      themeId: 'glitch',
      volume: 20,
    });
    const state = store.getState();
    expect(selectSoundEnabled(state)).toBe(false);
    expect(selectSoundThemeId(state)).toBe('glitch');
    expect(selectSoundVolume(state)).toBe(20);
  });

  it('applies a valid patch and keeps the other fields', () => {
    const store = createStore();
    store.getState().setSoundPreferences({ volume: 80 });
    expect(store.getState().preferences.sound).toEqual({
      ...DEFAULT_SOUND_PREFERENCES,
      volume: 80,
    });
  });

  it('notifies subscribers once for a valid change', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().setSoundPreferences({ themeId: 'terminal' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an invalid volume', { volume: 500 }],
    ['an unknown theme', { themeId: 'bogus' }],
    ['an unknown key', { loud: true }],
    ['an empty patch', {}],
    ['a non-object', 'volume'],
  ])('ignores %s without notifying', (_label, patch) => {
    const store = createStore();
    const before = store.getState().preferences;
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().setSoundPreferences(patch);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().preferences).toBe(before);
  });

  it('ignores a patch that changes nothing without notifying', () => {
    const store = createStore();
    const before = store.getState().preferences;
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().setSoundPreferences({ ...DEFAULT_SOUND_PREFERENCES });
    store.getState().setSoundPreferences({ volume: DEFAULT_SOUND_PREFERENCES.volume });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().preferences).toBe(before);
  });

  it.each<TimerStatus>(['idle', 'running', 'paused', 'completed'])(
    'is not locked while the timer is %s',
    (status) => {
      const store = createStore();
      store.setState({ timer: { ...store.getState().timer, status } });
      store.getState().setSoundPreferences({ volume: 10 });
      expect(store.getState().preferences.sound.volume).toBe(10);
    },
  );
});

describe('requestSetSoundPreferences (M5.T9)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (
    sendMutation?: (message: MutationMessage) => void,
  ): ReturnType<typeof createAppStore> =>
    createAppStore({
      dependencies: { alarmProvider: new FakeAlarmProvider(), sendMutation },
    });

  it('sends exactly one PREFERENCES_SOUND_SET with the given patch', () => {
    const sendMutation = vi.fn();
    const store = createStore(sendMutation);

    store.getState().requestSetSoundPreferences({ volume: 80 });

    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'PREFERENCES_SOUND_SET',
      payload: { volume: 80 },
    });
  });

  it('does not change the local state: the popup converges through the sync', () => {
    const store = createStore(vi.fn());
    const before = store.getState().preferences;
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().requestSetSoundPreferences({ enabled: false, volume: 5 });

    expect(store.getState().preferences).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('is a no-op that does not throw without a sendMutation', () => {
    const store = createStore(undefined);
    expect(() => {
      store.getState().requestSetSoundPreferences({ volume: 80 });
    }).not.toThrow();
    expect(store.getState().preferences.sound).toEqual(DEFAULT_SOUND_PREFERENCES);
  });

  it('forwards the patch as given, without validating it (the background does)', () => {
    const sendMutation = vi.fn();
    const store = createStore(sendMutation);

    store.getState().requestSetSoundPreferences({ volume: 500 });

    expect(sendMutation).toHaveBeenCalledWith({
      type: 'PREFERENCES_SOUND_SET',
      payload: { volume: 500 },
    });
  });
});
