import { onMessage } from '@/lib/messaging/bus';
import type { Logger } from '@/utils/logger';
import { isSoundPlayRequest, type SoundPlayer } from './sound-player';

/**
 * Plays every `PLAY_SOUND` the background sends. The payload crossed a message
 * boundary, so it is validated here: a bad one is dropped with a warning that
 * carries the message type only. Returns the disposer.
 */
export function listenForPlaySound(
  player: SoundPlayer,
  logger: Logger,
): () => void {
  return onMessage(
    'PLAY_SOUND',
    async (message) => {
      if (!isSoundPlayRequest(message.payload)) {
        logger.warn('ignored an invalid sound request', { type: message.type });
        return;
      }
      const result = await player.play(message.payload);
      if (!result.ok) {
        logger.error('sound playback failed', result.error, {
          type: message.type,
        });
      }
    },
    logger,
  );
}
