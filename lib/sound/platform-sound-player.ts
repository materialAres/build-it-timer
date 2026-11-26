import { browser } from 'wxt/browser';
import type { AudioContextLike } from './audio-context.types';
import {
  createBrowserOffscreenApi,
  createOffscreenSoundPlayer,
} from './offscreen-sound-player';
import {
  createDirectSoundPlayer,
  createSilentSoundPlayer,
  type SoundPlayer,
} from './sound-player';
import { createWebAudioRenderer } from './web-audio-renderer';

export interface SoundEnvironment {
  readonly hasOffscreenApi: boolean;
  /** Missing when the context has no `AudioContext` at all. */
  readonly createAudioContext?: () => AudioContextLike;
}

/** How each kind of player is built; injectable so tests need no real API. */
export interface PlayerFactories {
  offscreen(): SoundPlayer;
  direct(createAudioContext: () => AudioContextLike): SoundPlayer;
  silent(): SoundPlayer;
}

export const DEFAULT_PLAYER_FACTORIES: PlayerFactories = {
  offscreen: () => createOffscreenSoundPlayer(createBrowserOffscreenApi()),
  direct: (createAudioContext) =>
    createDirectSoundPlayer(createWebAudioRenderer(createAudioContext)),
  silent: createSilentSoundPlayer,
};

/**
 * Chrome's service worker cannot play, so it goes through an offscreen
 * document; Firefox's event page has a DOM and plays directly; anything else
 * stays silent instead of failing.
 */
export function selectSoundPlayer(
  environment: SoundEnvironment,
  factories: PlayerFactories = DEFAULT_PLAYER_FACTORIES,
): SoundPlayer {
  if (environment.hasOffscreenApi) return factories.offscreen();
  if (environment.createAudioContext) {
    return factories.direct(environment.createAudioContext);
  }
  return factories.silent();
}

/**
 * Detection is by feature, not by browser name, so a Chromium-based browser
 * without `offscreen` falls back cleanly. `browser.offscreen` is typed as
 * always present, which is why it is read through a wider type.
 */
export function detectSoundEnvironment(): SoundEnvironment {
  const { offscreen } = browser as { offscreen?: { createDocument?: unknown } };
  const hasOffscreenApi = typeof offscreen?.createDocument === 'function';
  if (typeof AudioContext !== 'function') return { hasOffscreenApi };
  return { hasOffscreenApi, createAudioContext: () => new AudioContext() };
}

export function createPlatformSoundPlayer(): SoundPlayer {
  return selectSoundPlayer(detectSoundEnvironment());
}
