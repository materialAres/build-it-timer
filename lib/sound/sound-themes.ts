import type {
  NoiseVoice,
  OscillatorVoice,
  SoundEnvelope,
  SoundNote,
  SoundTheme,
  SoundThemeId,
} from './sound.types';

export const DEFAULT_SOUND_THEME_ID: SoundThemeId = 'neon';

const A3 = 220;
const A4 = 440;
const E5 = 659.25;
const A5 = 880;

const C4 = 261.63;
const G4 = 392;
const C5 = 523.25;
const EB5 = 622.25;
const G5 = 783.99;
const C6 = 1046.5;

const NEON_ENVELOPE: SoundEnvelope = { attackSec: 0.005, releaseSec: 0.25 };

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

const NEON_DELAY = { timeSec: 0.18, feedback: 0.35, mix: 0.3 };

const ARPEGGIO_ENVELOPE: SoundEnvelope = { attackSec: 0.005, releaseSec: 0.1 };

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

const SYNTHWAVE_DELAY = { timeSec: 0.12, feedback: 0.4, mix: 0.35 };

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

export const SOUND_THEMES: ReadonlyArray<SoundTheme> = [
  {
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
  },
  {
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
  },
  {
    id: 'glitch',
    start: {
      voices: [glitchStartNoise, glitchStartBlips],
      effects: { bitcrush: { bits: 4 } },
    },
    end: {
      voices: [glitchEndNoise, glitchEndSlide],
      effects: { bitcrush: { bits: 5 } },
    },
  },
  {
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
  },
];

export function isSoundThemeId(value: unknown): value is SoundThemeId {
  return SOUND_THEMES.some((theme) => theme.id === value);
}

export function findSoundTheme(id: SoundThemeId): SoundTheme {
  const theme = SOUND_THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) {
    throw new Error(`Unknown sound theme: ${id}`);
  }
  return theme;
}
