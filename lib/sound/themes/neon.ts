import type {
  OscillatorVoice,
  SoundEnvelope,
  SoundNote,
  SoundTheme,
} from '../sound.types';

const A3 = 220;
const A4 = 440;
const E5 = 659.25;
const A5 = 880;

const NEON_ENVELOPE: SoundEnvelope = { attackSec: 0.005, releaseSec: 0.25 };

const NEON_DELAY = { timeSec: 0.18, feedback: 0.35, mix: 0.3 };

function neonVoices(
  chime: ReadonlyArray<SoundNote>,
  sweep: { readonly fromHz: number; readonly toHz: number },
  bass: SoundNote,
): ReadonlyArray<OscillatorVoice> {
  return [
    {
      kind: 'oscillator',
      waveform: 'sawtooth',
      detuneCents: [-8, 8],
      gain: 0.3,
      envelope: NEON_ENVELOPE,
      notes: chime,
      filter: { type: 'lowpass', ...sweep, q: 6 },
    },
    {
      kind: 'oscillator',
      waveform: 'sine',
      detuneCents: [0],
      gain: 0.2,
      envelope: NEON_ENVELOPE,
      notes: [bass],
    },
  ];
}

/** Detuned saw chime through an opening (start) or closing (end) filter. */
export const NEON_THEME: SoundTheme = {
  id: 'neon',
  start: {
    voices: neonVoices(
      [
        { frequencyHz: A4, startSec: 0, durationSec: 0.12 },
        { frequencyHz: E5, startSec: 0.1, durationSec: 0.12 },
        { frequencyHz: A5, startSec: 0.2, durationSec: 0.35 },
      ],
      { fromHz: 600, toHz: 5000 },
      { frequencyHz: A3, startSec: 0.2, durationSec: 0.35 },
    ),
    effects: { delay: NEON_DELAY },
  },
  end: {
    voices: neonVoices(
      [
        { frequencyHz: A5, startSec: 0, durationSec: 0.12 },
        { frequencyHz: E5, startSec: 0.1, durationSec: 0.12 },
        { frequencyHz: A4, startSec: 0.2, durationSec: 0.5 },
      ],
      { fromHz: 5000, toHz: 500 },
      { frequencyHz: A3, startSec: 0.2, durationSec: 0.5 },
    ),
    effects: { delay: NEON_DELAY },
  },
};
