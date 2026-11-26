import { err, ok, type Result } from '@/utils/result';
import { createLogger, type Logger } from '@/utils/logger';
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioSourceLike,
} from './audio-context.types';
import type { PlannedTone, PlaybackPlan } from './playback-plan';
import type { SoundEffects } from './sound.types';
import { calculateBitcrushCurve, calculateNoiseSamples } from './waveshapes';

export type { AudioContextLike } from './audio-context.types';

export interface SoundRenderer {
  play(plan: PlaybackPlan): Promise<Result<void>>;
  /** Stop every source still scheduled (used by the preview, M5.T18). */
  stopAll(): void;
  dispose(): Promise<void>;
}

/** Lets the first scheduled start fall slightly after "now" on every browser. */
const START_OFFSET_SEC = 0.02;
const SILENT_GAIN = 0.0001;
const NOISE_SEED = 1;

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Routes the master gain to the destination, through the optional effects. */
function connectMaster(
  context: AudioContextLike,
  master: AudioNodeLike,
  effects: SoundEffects,
): void {
  let output = master;
  if (effects.bitcrush) {
    const shaper = context.createWaveShaper();
    shaper.curve = calculateBitcrushCurve(effects.bitcrush.bits);
    output.connect(shaper);
    output = shaper;
  }
  output.connect(context.destination);
  if (effects.delay) {
    const { timeSec, feedback, mix } = effects.delay;
    const delay = context.createDelay(Math.max(1, timeSec));
    delay.delayTime.value = timeSec;
    const feedbackGain = context.createGain();
    feedbackGain.gain.value = feedback;
    const wet = context.createGain();
    wet.gain.value = mix;
    output.connect(delay);
    delay.connect(feedbackGain);
    feedbackGain.connect(delay);
    delay.connect(wet);
    wet.connect(context.destination);
  }
}

function connectEnvelope(
  context: AudioContextLike,
  tone: PlannedTone,
  startAt: number,
  master: AudioNodeLike,
): AudioNodeLike {
  const envelope = context.createGain();
  const holdUntil = startAt + Math.max(tone.attackSec, tone.durationSec);
  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(tone.peakGain, startAt + tone.attackSec);
  envelope.gain.setValueAtTime(tone.peakGain, holdUntil);
  envelope.gain.exponentialRampToValueAtTime(
    SILENT_GAIN,
    startAt + tone.durationSec + tone.releaseSec,
  );
  envelope.connect(master);

  if (!tone.filter) return envelope;
  const filter = context.createBiquadFilter();
  filter.type = tone.filter.type;
  filter.Q.value = tone.filter.q;
  filter.frequency.setValueAtTime(tone.filter.fromHz, startAt);
  filter.frequency.exponentialRampToValueAtTime(
    tone.filter.toHz,
    startAt + tone.durationSec,
  );
  filter.connect(envelope);
  return filter;
}

export function createWebAudioRenderer(
  createContext: () => AudioContextLike,
  logger: Logger = createLogger('sound:renderer'),
): SoundRenderer {
  let context: AudioContextLike | null = null;
  let noiseBuffer: ReturnType<AudioContextLike['createBuffer']> | null = null;
  const active = new Set<AudioSourceLike>();

  const getContext = (): AudioContextLike => {
    context ??= createContext();
    return context;
  };

  const getNoiseBuffer = (ctx: AudioContextLike) => {
    if (noiseBuffer === null) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      noiseBuffer
        .getChannelData(0)
        .set(calculateNoiseSamples(ctx.sampleRate, NOISE_SEED));
    }
    return noiseBuffer;
  };

  const createSource = (ctx: AudioContextLike, tone: PlannedTone, at: number) => {
    if (tone.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      source.loop = true;
      return source;
    }
    const source = ctx.createOscillator();
    source.type = tone.waveform;
    source.frequency.setValueAtTime(tone.frequencyHz, at);
    if (tone.glideToHz !== undefined) {
      source.frequency.exponentialRampToValueAtTime(
        tone.glideToHz,
        at + tone.durationSec,
      );
    }
    source.detune.value = tone.detuneCents;
    return source;
  };

  const schedule = (ctx: AudioContextLike, plan: PlaybackPlan): void => {
    const master = ctx.createGain();
    master.gain.value = plan.masterGain;
    connectMaster(ctx, master, plan.effects);

    for (const tone of plan.tones) {
      const startAt = ctx.currentTime + START_OFFSET_SEC + tone.startSec;
      const source = createSource(ctx, tone, startAt);
      source.connect(connectEnvelope(ctx, tone, startAt, master));
      source.onended = () => {
        active.delete(source);
      };
      active.add(source);
      source.start(startAt);
      source.stop(startAt + tone.durationSec + tone.releaseSec);
    }
  };

  const stopAll = (): void => {
    for (const source of active) source.stop(0);
  };

  return {
    stopAll,
    async play(plan): Promise<Result<void>> {
      if (plan.tones.length === 0) return ok(undefined);
      try {
        const ctx = getContext();
        if (ctx.state === 'suspended') await ctx.resume();
        schedule(ctx, plan);
        return ok(undefined);
      } catch (cause) {
        return err(toError(cause));
      }
    },
    async dispose(): Promise<void> {
      stopAll();
      const closing = context;
      context = null;
      noiseBuffer = null;
      active.clear();
      if (closing === null) return;
      try {
        await closing.close();
      } catch (cause) {
        logger.warn('audio context failed to close', { cause: toError(cause).message });
      }
    },
  };
}
