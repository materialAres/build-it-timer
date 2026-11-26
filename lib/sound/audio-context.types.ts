/**
 * The smallest slice of the Web Audio API the sound renderer uses. The real
 * `AudioContext` satisfies it structurally, so production passes it as is and
 * tests pass `FakeAudioContext` (principle L).
 */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioSourceLike extends AudioNodeLike {
  start(when?: number): void;
  stop(when?: number): void;
  onended: ((event: Event) => unknown) | null;
}

export interface OscillatorLike extends AudioSourceLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  readonly detune: AudioParamLike;
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceLike extends AudioSourceLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
}

export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface BiquadFilterLike extends AudioNodeLike {
  type: BiquadFilterType;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface DelayLike extends AudioNodeLike {
  readonly delayTime: AudioParamLike;
}

export interface WaveShaperLike extends AudioNodeLike {
  curve: Float32Array | null;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: AudioContextState;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBiquadFilter(): BiquadFilterLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBufferLike;
  createDelay(maxDelayTime?: number): DelayLike;
  createWaveShaper(): WaveShaperLike;
}
