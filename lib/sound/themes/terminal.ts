import type {
  OscillatorVoice,
  SoundEnvelope,
  SoundNote,
  SoundTheme,
} from '../sound.types';

const TERMINAL_ENVELOPE: SoundEnvelope = { attackSec: 0.002, releaseSec: 0.03 };

function terminalBeeps(notes: ReadonlyArray<SoundNote>): OscillatorVoice {
  return {
    kind: 'oscillator',
    waveform: 'square',
    detuneCents: [0],
    gain: 0.2,
    envelope: TERMINAL_ENVELOPE,
    notes,
  };
}

/** Dry square-wave beeps: rising (start), falling (end). */
export const TERMINAL_THEME: SoundTheme = {
  id: 'terminal',
  start: {
    voices: [
      terminalBeeps([
        { frequencyHz: 1000, startSec: 0, durationSec: 0.05 },
        { frequencyHz: 1000, startSec: 0.09, durationSec: 0.05 },
        { frequencyHz: 1500, startSec: 0.18, durationSec: 0.12 },
      ]),
    ],
    effects: {},
  },
  end: {
    voices: [
      terminalBeeps([
        { frequencyHz: 1500, startSec: 0, durationSec: 0.08 },
        { frequencyHz: 1000, startSec: 0.12, durationSec: 0.08 },
        { frequencyHz: 750, startSec: 0.24, durationSec: 0.25 },
      ]),
    ],
    effects: {},
  },
};
