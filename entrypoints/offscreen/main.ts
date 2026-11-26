import { listenForPlaySound } from '@/lib/sound/play-sound-listener';
import { createDirectSoundPlayer } from '@/lib/sound/sound-player';
import { createWebAudioRenderer } from '@/lib/sound/web-audio-renderer';
import { createLogger } from '@/utils/logger';

// Wiring only (principle S): no state, no store, no decisions. The background
// decides when a cue plays; this page turns the message into sound.
listenForPlaySound(
  createDirectSoundPlayer(createWebAudioRenderer(() => new AudioContext())),
  createLogger('offscreen'),
);
