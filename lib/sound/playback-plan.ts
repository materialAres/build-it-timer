import type {
  NoiseVoice,
  OscillatorVoice,
  SoundEffects,
  SoundFilter,
  SoundRecipe,
  Waveform,
} from './sound.types';

interface ToneTiming {
  readonly startSec: number;
  readonly durationSec: number;
  readonly peakGain: number;
  readonly attackSec: number;
  readonly releaseSec: number;
  readonly filter?: SoundFilter;
}

export interface PlannedOscillatorTone extends ToneTiming {
  readonly kind: 'oscillator';
  readonly waveform: Waveform;
  readonly frequencyHz: number;
  readonly glideToHz?: number;
  readonly detuneCents: number;
}

export interface PlannedNoiseTone extends ToneTiming {
  readonly kind: 'noise';
}

export type PlannedTone = PlannedOscillatorTone | PlannedNoiseTone;

export interface PlaybackPlan {
  readonly tones: ReadonlyArray<PlannedTone>;
  readonly masterGain: number;
  readonly effects: SoundEffects;
  readonly durationSec: number;
}

const DELAY_TAIL_REPEATS = 4;

/** Perceptual curve: loudness is not linear in amplitude. */
export function calculateVolumeGain(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return (Math.min(100, Math.max(0, volume)) / 100) ** 2;
}

function planOscillator(voice: OscillatorVoice): PlannedOscillatorTone[] {
  return voice.notes.flatMap((note) =>
    voice.detuneCents.map(
      (detuneCents): PlannedOscillatorTone => ({
        kind: 'oscillator',
        waveform: voice.waveform,
        frequencyHz: note.frequencyHz,
        ...(note.glideToHz !== undefined && { glideToHz: note.glideToHz }),
        detuneCents,
        startSec: note.startSec,
        durationSec: note.durationSec,
        peakGain: voice.gain,
        attackSec: voice.envelope.attackSec,
        releaseSec: voice.envelope.releaseSec,
        ...(voice.filter && { filter: voice.filter }),
      }),
    ),
  );
}

function planNoise(voice: NoiseVoice): PlannedNoiseTone[] {
  return voice.bursts.map(
    (burst): PlannedNoiseTone => ({
      kind: 'noise',
      startSec: burst.startSec,
      durationSec: burst.durationSec,
      peakGain: voice.gain,
      attackSec: voice.envelope.attackSec,
      releaseSec: voice.envelope.releaseSec,
      ...(voice.filter && { filter: voice.filter }),
    }),
  );
}

function calculateEndSec(
  tones: ReadonlyArray<PlannedTone>,
  effects: SoundEffects,
): number {
  const lastTone = Math.max(
    ...tones.map((tone) => tone.startSec + tone.durationSec + tone.releaseSec),
  );
  const tail = effects.delay ? DELAY_TAIL_REPEATS * effects.delay.timeSec : 0;
  return lastTone + tail;
}

export function calculatePlaybackPlan(
  recipe: SoundRecipe,
  volume: number,
): PlaybackPlan {
  const masterGain = calculateVolumeGain(volume);
  if (masterGain === 0) {
    return { tones: [], masterGain, effects: recipe.effects, durationSec: 0 };
  }
  const tones = recipe.voices.flatMap((voice): PlannedTone[] =>
    voice.kind === 'oscillator' ? planOscillator(voice) : planNoise(voice),
  );
  return {
    tones,
    masterGain,
    effects: recipe.effects,
    durationSec: tones.length === 0 ? 0 : calculateEndSec(tones, recipe.effects),
  };
}
