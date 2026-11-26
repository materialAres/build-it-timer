import type {
  NoiseVoice,
  OscillatorVoice,
  SoundEnvelope,
  SoundTheme,
} from '../sound.types';

const GLITCH_ENVELOPE: SoundEnvelope = { attackSec: 0.002, releaseSec: 0.02 };
const GLITCH_END_ENVELOPE: SoundEnvelope = { attackSec: 0.005, releaseSec: 0.1 };

const glitchStartNoise: NoiseVoice = {
  kind: 'noise',
  gain: 0.3,
  envelope: GLITCH_ENVELOPE,
  bursts: [0, 0.05, 0.1].map((startSec) => ({ startSec, durationSec: 0.03 })),
  filter: { type: 'bandpass', fromHz: 3000, toHz: 3000, q: 8 },
};

const glitchStartBlips: OscillatorVoice = {
  kind: 'oscillator',
  waveform: 'square',
  detuneCents: [0],
  gain: 0.2,
  envelope: GLITCH_ENVELOPE,
  notes: [
    { frequencyHz: 1318.5, startSec: 0, durationSec: 0.03 },
    { frequencyHz: 659.25, startSec: 0.05, durationSec: 0.03 },
    { frequencyHz: 1975.5, startSec: 0.1, durationSec: 0.03 },
  ],
};

const glitchEndNoise: NoiseVoice = {
  kind: 'noise',
  gain: 0.3,
  envelope: GLITCH_END_ENVELOPE,
  bursts: [{ startSec: 0, durationSec: 0.4 }],
  filter: { type: 'bandpass', fromHz: 6000, toHz: 400, q: 8 },
};

const glitchEndSlide: OscillatorVoice = {
  kind: 'oscillator',
  waveform: 'square',
  detuneCents: [0],
  gain: 0.2,
  envelope: GLITCH_END_ENVELOPE,
  notes: [{ frequencyHz: 880, glideToHz: 110, startSec: 0, durationSec: 0.5 }],
};

/** Bit-crushed noise bursts and blips (start), a falling noise slide (end). */
export const GLITCH_THEME: SoundTheme = {
  id: 'glitch',
  start: {
    voices: [glitchStartNoise, glitchStartBlips],
    effects: { bitcrush: { bits: 4 } },
  },
  end: {
    voices: [glitchEndNoise, glitchEndSlide],
    effects: { bitcrush: { bits: 5 } },
  },
};
