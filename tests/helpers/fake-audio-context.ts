import type {
  AudioContextLike,
  AudioParamLike,
} from '@/lib/sound/audio-context.types';

export interface ParamCall {
  readonly method: 'set' | 'linear' | 'exponential';
  readonly value: number;
  readonly time: number;
}

export class FakeParam implements AudioParamLike {
  value = 0;
  readonly calls: ParamCall[] = [];

  setValueAtTime(value: number, time: number): void {
    this.calls.push({ method: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push({ method: 'linear', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push({ method: 'exponential', value, time });
  }
}

export class FakeNode {
  readonly connections: FakeNode[] = [];

  constructor(
    readonly kind: string,
    protected readonly log: string[],
  ) {}

  connect<T extends FakeNode>(destination: T): T {
    this.connections.push(destination);
    return destination;
  }
}

class FakeSource extends FakeNode {
  readonly started: number[] = [];
  readonly stopped: number[] = [];
  onended: (() => void) | null = null;

  start(when = 0): void {
    this.log.push(`start:${this.kind}`);
    this.started.push(when);
  }

  stop(when = 0): void {
    this.stopped.push(when);
  }
}

export class FakeOscillator extends FakeSource {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();

  constructor(log: string[]) {
    super('oscillator', log);
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;

  constructor(log: string[]) {
    super('buffer-source', log);
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();

  constructor(log: string[]) {
    super('gain', log);
  }
}

export class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();

  constructor(log: string[]) {
    super('biquad', log);
  }
}

export class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();

  constructor(
    log: string[],
    readonly maxDelayTime: number,
  ) {
    super('delay', log);
  }
}

export class FakeWaveShaper extends FakeNode {
  curve: Float32Array | null = null;

  constructor(log: string[]) {
    super('wave-shaper', log);
  }
}

export class FakeBuffer {
  private readonly data: Float32Array;

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }

  getChannelData(): Float32Array {
    return this.data;
  }
}

/**
 * Records the nodes a renderer creates, how they are wired and every
 * `AudioParam` call, so tests assert on records and not on sound. `log` keeps
 * the order of `resume` and every source `start`.
 */
export class FakeAudioContext implements AudioContextLike {
  currentTime = 10;
  state: AudioContextState = 'running';
  readonly sampleRate = 8000;
  readonly log: string[] = [];
  readonly destination = new FakeNode('destination', this.log);
  readonly oscillators: FakeOscillator[] = [];
  readonly bufferSources: FakeBufferSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly filters: FakeBiquad[] = [];
  readonly delays: FakeDelay[] = [];
  readonly shapers: FakeWaveShaper[] = [];
  readonly buffers: FakeBuffer[] = [];
  closeCalls = 0;

  constructor(options: { suspended?: boolean } = {}) {
    if (options.suspended) this.state = 'suspended';
  }

  resume(): Promise<void> {
    this.log.push('resume');
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
    return Promise.resolve();
  }

  createOscillator(): FakeOscillator {
    const node = new FakeOscillator(this.log);
    this.oscillators.push(node);
    return node;
  }

  createBufferSource(): FakeBufferSource {
    const node = new FakeBufferSource(this.log);
    this.bufferSources.push(node);
    return node;
  }

  createGain(): FakeGain {
    const node = new FakeGain(this.log);
    this.gains.push(node);
    return node;
  }

  createBiquadFilter(): FakeBiquad {
    const node = new FakeBiquad(this.log);
    this.filters.push(node);
    return node;
  }

  createDelay(maxDelayTime = 1): FakeDelay {
    const node = new FakeDelay(this.log, maxDelayTime);
    this.delays.push(node);
    return node;
  }

  createWaveShaper(): FakeWaveShaper {
    const node = new FakeWaveShaper(this.log);
    this.shapers.push(node);
    return node;
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    const buffer = new FakeBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }
}
