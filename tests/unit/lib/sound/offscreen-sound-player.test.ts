import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import {
  createBrowserOffscreenApi,
  createOffscreenSoundPlayer,
  type OffscreenApi,
} from '@/lib/sound/offscreen-sound-player';
import type { SoundPlayRequest } from '@/lib/sound/sound-player';
import { err, ok, type Result } from '@/utils/result';

const REQUEST: SoundPlayRequest = { themeId: 'synthwave', cue: 'end', volume: 40 };

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** An offscreen API that remembers whether the document exists. */
function fakeApi(options: {
  exists?: boolean;
  create?: () => Promise<void>;
  has?: () => Promise<boolean>;
  send?: () => Promise<Result<undefined>>;
} = {}) {
  let exists = options.exists ?? false;
  const calls: string[] = [];
  const sent: RuntimeMessage[] = [];
  const api: OffscreenApi = {
    hasDocument() {
      calls.push('has');
      return options.has ? options.has() : Promise.resolve(exists);
    },
    async createDocument() {
      calls.push('create');
      await (options.create ? options.create() : Promise.resolve());
      exists = true;
    },
    send(message) {
      calls.push('send');
      sent.push(message);
      return options.send ? options.send() : Promise.resolve(ok(undefined));
    },
  };
  return { api, calls, sent };
}

describe('createOffscreenSoundPlayer', () => {
  it('creates the document, then sends one PLAY_SOUND', async () => {
    const { api, calls, sent } = fakeApi();
    const result = await createOffscreenSoundPlayer(api).play(REQUEST);

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['has', 'create', 'send']);
    expect(sent).toEqual([{ type: 'PLAY_SOUND', payload: REQUEST }]);
  });

  it('does not create the document when it already exists', async () => {
    const { api, calls } = fakeApi({ exists: true });
    await createOffscreenSoundPlayer(api).play(REQUEST);
    expect(calls).toEqual(['has', 'send']);
  });

  it('reuses the document it created on the next play', async () => {
    const { api, calls } = fakeApi();
    const player = createOffscreenSoundPlayer(api);
    await player.play(REQUEST);
    await player.play(REQUEST);
    expect(calls.filter((call) => call === 'create')).toHaveLength(1);
    expect(calls.filter((call) => call === 'send')).toHaveLength(2);
  });

  it('creates the document once for plays made while it is being created', async () => {
    const creation = deferred();
    const { api, calls, sent } = fakeApi({ create: () => creation.promise });
    const player = createOffscreenSoundPlayer(api);

    const first = player.play(REQUEST);
    const second = player.play({ ...REQUEST, cue: 'start' });
    creation.resolve();
    const results = await Promise.all([first, second]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(calls.filter((call) => call === 'create')).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it.each([
    ['an unknown theme', { ...REQUEST, themeId: 'bogus' }],
    ['the cue pause', { ...REQUEST, cue: 'pause' }],
    ['a volume above 100', { ...REQUEST, volume: 101 }],
    ['null', null],
  ])('returns an error without touching the API for %s', async (_label, request) => {
    const { api, calls } = fakeApi();
    const result = await createOffscreenSoundPlayer(api).play(
      request as unknown as SoundPlayRequest,
    );
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('returns an error, then retries the creation, when createDocument rejects', async () => {
    let attempts = 0;
    const { api, calls } = fakeApi({
      create: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('denied')) : Promise.resolve();
      },
    });
    const player = createOffscreenSoundPlayer(api);

    expect((await player.play(REQUEST)).ok).toBe(false);
    expect((await player.play(REQUEST)).ok).toBe(true);
    expect(calls.filter((call) => call === 'create')).toHaveLength(2);
  });

  it('returns an error, then retries, when hasDocument rejects', async () => {
    let attempts = 0;
    const { api } = fakeApi({
      has: () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('no contexts')) : Promise.resolve(true);
      },
    });
    const player = createOffscreenSoundPlayer(api);

    expect((await player.play(REQUEST)).ok).toBe(false);
    expect((await player.play(REQUEST)).ok).toBe(true);
  });

  it('returns the error of a send that fails', async () => {
    const failure = new Error('no receiver');
    const { api } = fakeApi({ exists: true, send: () => Promise.resolve(err(failure)) });
    const result = await createOffscreenSoundPlayer(api).play(REQUEST);
    expect(result).toEqual({ ok: false, error: failure });
  });

  it('turns a throwing send into an error result', async () => {
    const { api } = fakeApi({
      exists: true,
      send: () => {
        throw new Error('boom');
      },
    });
    const result = await createOffscreenSoundPlayer(api).play(REQUEST);
    expect(result.ok).toBe(false);
  });
});

describe('createBrowserOffscreenApi', () => {
  const createDocument = vi.fn(() => Promise.resolve());
  const getContexts = vi.fn((): Promise<unknown[]> => Promise.resolve([]));

  beforeEach(() => {
    fakeBrowser.reset();
    createDocument.mockClear();
    getContexts.mockClear();
    Object.assign(fakeBrowser, { offscreen: { createDocument } });
    Object.assign(fakeBrowser.runtime, { getContexts });
  });

  it('looks for an OFFSCREEN_DOCUMENT context', async () => {
    const api = createBrowserOffscreenApi();

    await expect(api.hasDocument()).resolves.toBe(false);
    getContexts.mockResolvedValueOnce([{ contextType: 'OFFSCREEN_DOCUMENT' }]);
    await expect(api.hasDocument()).resolves.toBe(true);
    expect(getContexts).toHaveBeenCalledWith({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
  });

  it('creates /offscreen.html for audio playback', async () => {
    await createBrowserOffscreenApi().createDocument();

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringMatching(/offscreen\.html$/) as string,
        reasons: ['AUDIO_PLAYBACK'],
        justification: expect.any(String) as string,
      }),
    );
  });
});
