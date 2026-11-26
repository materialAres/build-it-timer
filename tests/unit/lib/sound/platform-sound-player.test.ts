import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { AudioContextLike } from '@/lib/sound/audio-context.types';
import {
  createPlatformSoundPlayer,
  detectSoundEnvironment,
  selectSoundPlayer,
  type PlayerFactories,
} from '@/lib/sound/platform-sound-player';
import type { SoundPlayer } from '@/lib/sound/sound-player';
import { ok } from '@/utils/result';
import { FakeAudioContext } from '../../../helpers/fake-audio-context';

function labelledPlayer(label: string): SoundPlayer & { readonly label: string } {
  return { label, play: () => Promise.resolve(ok(undefined)) };
}

function fakeFactories() {
  const offscreen = vi.fn(() => labelledPlayer('offscreen'));
  const direct = vi.fn<PlayerFactories['direct']>(() => labelledPlayer('direct'));
  const silent = vi.fn(() => labelledPlayer('silent'));
  const factories: PlayerFactories = { offscreen, direct, silent };
  return { factories, offscreen, direct, silent };
}

const createAudioContext = (): AudioContextLike => new FakeAudioContext();

describe('selectSoundPlayer', () => {
  it('uses the offscreen player when the offscreen API exists (Chrome)', () => {
    const { factories, offscreen, direct, silent } = fakeFactories();

    const player = selectSoundPlayer(
      { hasOffscreenApi: true, createAudioContext },
      factories,
    );

    expect(player).toMatchObject({ label: 'offscreen' });
    expect(offscreen).toHaveBeenCalledTimes(1);
    expect(direct).not.toHaveBeenCalled();
    expect(silent).not.toHaveBeenCalled();
  });

  it('uses the direct player over the audio context without it (Firefox)', () => {
    const { factories, offscreen, direct, silent } = fakeFactories();

    const player = selectSoundPlayer(
      { hasOffscreenApi: false, createAudioContext },
      factories,
    );

    expect(player).toMatchObject({ label: 'direct' });
    expect(direct).toHaveBeenCalledWith(createAudioContext);
    expect(offscreen).not.toHaveBeenCalled();
    expect(silent).not.toHaveBeenCalled();
  });

  it('falls back to the silent player when there is no audio at all', () => {
    const { factories, offscreen, direct, silent } = fakeFactories();

    const player = selectSoundPlayer({ hasOffscreenApi: false }, factories);

    expect(player).toMatchObject({ label: 'silent' });
    expect(silent).toHaveBeenCalledTimes(1);
    expect(offscreen).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
  });
});

describe('detectSoundEnvironment', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(fakeBrowser, 'offscreen');
  });

  it('detects the offscreen API by feature, not by browser name', () => {
    Object.assign(fakeBrowser, { offscreen: { createDocument: vi.fn() } });
    expect(detectSoundEnvironment().hasOffscreenApi).toBe(true);
  });

  it('reports no offscreen API when it is missing', () => {
    expect(detectSoundEnvironment().hasOffscreenApi).toBe(false);
  });

  it('reports no offscreen API when the namespace has no createDocument', () => {
    Object.assign(fakeBrowser, { offscreen: {} });
    expect(detectSoundEnvironment().hasOffscreenApi).toBe(false);
  });

  it('offers an AudioContext factory when the global exists', () => {
    class StubAudioContext {
      readonly isStub = true;
    }
    vi.stubGlobal('AudioContext', StubAudioContext);

    const { createAudioContext: create } = detectSoundEnvironment();

    expect(create?.()).toBeInstanceOf(StubAudioContext);
  });

  it('offers no AudioContext factory when the global is missing', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(detectSoundEnvironment().createAudioContext).toBeUndefined();
  });
});

describe('createPlatformSoundPlayer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a silent player that succeeds when the browser has no audio', async () => {
    vi.stubGlobal('AudioContext', undefined);

    const player = createPlatformSoundPlayer();

    await expect(
      player.play({ themeId: 'neon', cue: 'start', volume: 50 }),
    ).resolves.toEqual({ ok: true, value: undefined });
  });
});
