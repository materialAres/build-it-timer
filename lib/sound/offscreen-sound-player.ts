import { browser } from 'wxt/browser';
import { sendMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import { err, ok, type Result } from '@/utils/result';
import { isSoundPlayRequest, type SoundPlayer } from './sound-player';

/** What the Chrome background needs from `browser.offscreen`, injectable. */
export interface OffscreenApi {
  hasDocument(): Promise<boolean>;
  createDocument(): Promise<void>;
  /** Same contract as the bus's `sendMessage`: a failure is an `err`, not a throw. */
  send(message: RuntimeMessage): Promise<Result<undefined>>;
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * The Chrome service worker has no `AudioContext`, so it asks an offscreen
 * document to play. Chrome allows one such document per extension and closes an
 * `AUDIO_PLAYBACK` one after about 30 s of silence, so it is checked on every
 * play and created on demand, never kept alive.
 */
export function createOffscreenSoundPlayer(api: OffscreenApi): SoundPlayer {
  // Plays made while the document is being created share this promise: a second
  // `createDocument` would throw, because only one document may exist.
  let creating: Promise<void> | null = null;

  const ensureDocument = (): Promise<void> => {
    creating ??= (async () => {
      try {
        if (!(await api.hasDocument())) await api.createDocument();
      } finally {
        // Cleared on failure too, so the next play retries.
        creating = null;
      }
    })();
    return creating;
  };

  return {
    async play(request): Promise<Result<void>> {
      if (!isSoundPlayRequest(request)) {
        return err(new Error('invalid sound request'));
      }
      try {
        await ensureDocument();
        // `createDocument` resolves once the page has loaded, which is after its
        // module script registered the `PLAY_SOUND` listener.
        const sent = await api.send({ type: 'PLAY_SOUND', payload: request });
        return sent.ok ? ok(undefined) : sent;
      } catch (cause) {
        return err(toError(cause));
      }
    },
  };
}

/** The only code in the project that touches `browser.offscreen`. */
export function createBrowserOffscreenApi(): OffscreenApi {
  return {
    async hasDocument(): Promise<boolean> {
      const contexts = await browser.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });
      return contexts.length > 0;
    },
    createDocument(): Promise<void> {
      return browser.offscreen.createDocument({
        url: browser.runtime.getURL('/offscreen.html'),
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play the focus session start and end sounds',
      });
    },
    send: sendMessage,
  };
}
