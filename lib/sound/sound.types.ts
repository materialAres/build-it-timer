export type SoundCue = 'start' | 'end';

export type SoundThemeId = 'neon' | 'synthwave' | 'glitch' | 'terminal';

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SoundNote {
  readonly frequencyHz: number;
  readonly startSec: number;
  readonly durationSec: number;
  /** Slide the pitch to this frequency over the note. */
  readonly glideToHz?: number;
}

/** The release starts after the note's `durationSec`. */
export interface SoundEnvelope {
  readonly attackSec: number;
  readonly releaseSec: number;
}

/** The cutoff sweeps from `fromHz` to `toHz` over each note or burst. */
export interface SoundFilter {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  readonly fromHz: number;
  readonly toHz: number;
  readonly q: number;
}

/** One oscillator per detune value per note (unison). */
export interface OscillatorVoice {
  readonly kind: 'oscillator';
  readonly waveform: Waveform;
  readonly detuneCents: ReadonlyArray<number>;
  readonly gain: number;
  readonly envelope: SoundEnvelope;
  readonly notes: ReadonlyArray<SoundNote>;
  readonly filter?: SoundFilter;
}

export interface NoiseBurst {
  readonly startSec: number;
  readonly durationSec: number;
}

export interface NoiseVoice {
  readonly kind: 'noise';
  readonly gain: number;
  readonly envelope: SoundEnvelope;
  readonly bursts: ReadonlyArray<NoiseBurst>;
  readonly filter?: SoundFilter;
}

export interface SoundEffects {
  readonly delay?: {
    readonly timeSec: number;
    readonly feedback: number;
    readonly mix: number;
  };
  readonly bitcrush?: { readonly bits: number };
}

export interface SoundRecipe {
  readonly voices: ReadonlyArray<OscillatorVoice | NoiseVoice>;
  readonly effects: SoundEffects;
}

export interface SoundTheme {
  readonly id: SoundThemeId;
  readonly start: SoundRecipe;
  readonly end: SoundRecipe;
}
