import type {
  OscillatorVoice,
  SoundEnvelope,
  SoundNote,
  SoundTheme,
} from '../sound.types';

const C4 = 261.63;
const G4 = 392;
const C5 = 523.25;
const EB5 = 622.25;
const G5 = 783.99;
const C6 = 1046.5;

const ARPEGGIO_ENVELOPE: SoundEnvelope = { attackSec: 0.005, releaseSec: 0.1 };

const SYNTHWAVE_DELAY = { timeSec: 0.12, feedback: 0.4, mix: 0.35 };

function arpeggio(frequencies: ReadonlyArray<number>): ReadonlyArray<SoundNote> {
  return frequencies.map((frequencyHz, index) => ({
    frequencyHz,
    startSec: index * 0.07,
    durationSec: 0.08,
  }));
}

function synthwaveArpeggio(
  frequencies: ReadonlyArray<number>,
): OscillatorVoice {
  return {
    kind: 'oscillator',
    waveform: 'square',
    detuneCents: [0],
    gain: 0.25,
    envelope: ARPEGGIO_ENVELOPE,
    notes: arpeggio(frequencies),
    filter: { type: 'lowpass', fromHz: 2000, toHz: 6000, q: 1 },
  };
}

/** A rising (start) or falling (end) square arpeggio; the end adds a closing pad. */
export const SYNTHWAVE_THEME: SoundTheme = {
  id: 'synthwave',
  start: {
    voices: [synthwaveArpeggio([C5, EB5, G5, C6])],
    effects: { delay: SYNTHWAVE_DELAY },
  },
  end: {
    voices: [
      synthwaveArpeggio([C6, G5, EB5, C5]),
      {
        kind: 'oscillator',
        waveform: 'sawtooth',
        detuneCents: [0],
        gain: 0.2,
        envelope: { attackSec: 0.02, releaseSec: 0.2 },
        notes: [
          { frequencyHz: C4, startSec: 0.28, durationSec: 0.6 },
          { frequencyHz: G4, startSec: 0.28, durationSec: 0.6 },
        ],
        filter: { type: 'lowpass', fromHz: 3000, toHz: 300, q: 1 },
      },
    ],
    effects: { delay: SYNTHWAVE_DELAY },
  },
};
