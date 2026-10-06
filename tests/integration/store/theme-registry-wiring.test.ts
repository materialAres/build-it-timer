import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, selectCityThemeId } from '@/store';
import {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  getThemeById,
} from '@/lib/city/theme-registry';

describe('theme registry wiring (M2.T13b)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('assigns the registry biome for the session through the default store', () => {
    const store = createAppStore();
    store.getState().resetCityForNewSession('session-theme-1');

    const themeId = selectCityThemeId(store.getState());
    expect(getThemeById(themeId ?? '')).toBeDefined();
  });

  it('assigns a different biome to a different session (session-to-session variety)', () => {
    const store = createAppStore();

    const ids = Array.from({ length: 20 }, (_, index) => `session-${String(index)}`);
    const chosen = new Set(
      ids.map((sessionId) => {
        store.getState().resetCityForNewSession(sessionId);
        return selectCityThemeId(store.getState());
      }),
    );

    expect(chosen.size).toBeGreaterThan(1);
  });

  it('includes the documented default id in the registry', () => {
    expect(THEME_REGISTRY.some((theme) => theme.id === DEFAULT_THEME_ID)).toBe(
      true,
    );
  });
});
