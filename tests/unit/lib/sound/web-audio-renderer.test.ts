import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { AudioContextLike } from '@/lib/sound/audio-context.types';
import { calculatePlaybackPlan } from '@/lib/sound/playback-plan';
import type { PlaybackPlan } from '@/lib/sound/playback-plan';
import type { SoundRecipe } from '@/lib/sound/sound.types';
import { createWebAudioRenderer } from '@/lib/sound/web-audio-renderer';
import { createLogger } from '@/utils/logger';
import { FakeAudioContext } from '../../../helpers/fake-audio-context';

const OFFSET = 0.02;

const BASE: SoundRecipe = {
  voices: [
    {
      kind: 'oscillator',
      waveform: 'square',
      detuneCents: [-5, 5],
      gain: 0.4,
      envelope: { attackSec: 0.01, releaseSec: 0.2 },
      notes: [
        { frequencyHz: 440, startSec: 0, durationSec: 0.1 },
        { frequencyHz: 880, glideToHz: 220, startSec: 0.3, durationSec: 0.2 },
      ],
      filter: { type: 'lowpass', fromHz: 600, toHz: 5000, q: 6 },
    },
    {
      kind: 'noise',
      gain: 0.2,
      envelope: { attackSec: 0.002, releaseSec: 0.05 },
      bursts: [{ startSec: 0.1, durationSec: 0.1 }],
    },
  ],
  effects: {},
};

function planOf(recipe: SoundRecipe = BASE, volume = 100): PlaybackPlan {
  return calculatePlaybackPlan(recipe, volume);
}

function setup(options: { suspended?: boolean } = {}) {
  const context = new FakeAudioContext(options);
  const createContext = vi.fn((): AudioContextLike => context);
  const renderer = createWebAudioRenderer(createContext, createLogger('test'));
  return { context, createContext, renderer };
}

describe('AudioContextLike', () => {
  it('is satisfied by the real AudioContext', () => {
    expectTypeOf<AudioContext>().toExtend<AudioContextLike>();
  });
});

describe('createWebAudioRenderer', () => {
  describe('scheduling', () => {
    it('creates one source per tone', async () => {
      const { context, renderer } = setup();
      const result = await renderer.play(planOf());
      expect(result.ok).toBe(true);
      expect(context.oscillators).toHaveLength(4);
      expect(context.bufferSources).toHaveLength(1);
    });

    it('starts and stops each oscillator at the plan time plus the offset', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      const first = context.oscillators[0];
      expect(first?.type).toBe('square');
      expect(first?.detune.value).toBe(-5);
      expect(first?.started).toEqual([10 + OFFSET]);
      // start 0 + duration 0.1 + release 0.2
      expect(first?.stopped[0]).toBeCloseTo(10 + OFFSET + 0.3, 10);
    });

    it('shapes each envelope: ramp up, hold, exponential release', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      // gains[0] is the master; gains[1] is the first tone's envelope.
      const calls = context.gains[1]?.gain.calls ?? [];
      const t0 = 10 + OFFSET;
      expect(calls).toEqual([
        { method: 'set', value: 0, time: t0 },
        { method: 'linear', value: 0.4, time: t0 + 0.01 },
        { method: 'set', value: 0.4, time: t0 + 0.1 },
        { method: 'exponential', value: 0.0001, time: t0 + 0.1 + 0.2 },
      ]);
    });

    it('sweeps the filter cutoff over the tone duration', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      const filter = context.filters[0];
      const t0 = 10 + OFFSET;
      expect(filter?.type).toBe('lowpass');
      expect(filter?.Q.value).toBe(6);
      expect(filter?.frequency.calls).toEqual([
        { method: 'set', value: 600, time: t0 },
        { method: 'exponential', value: 5000, time: t0 + 0.1 },
      ]);
    });

    it('glides the pitch with an exponential ramp', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      const glided = context.oscillators[2];
      const t0 = 10 + OFFSET + 0.3;
      expect(glided?.frequency.calls).toEqual([
        { method: 'set', value: 880, time: t0 },
        { method: 'exponential', value: 220, time: t0 + 0.2 },
      ]);
    });

    it('sets the master gain from the plan', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf(BASE, 50));
      expect(context.gains[0]?.gain.value).toBe(0.25);
    });

    it('wires tones through their envelope to the master and the destination', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      const master = context.gains[0];
      expect(master?.connections).toEqual([context.destination]);
      for (const envelope of context.gains.slice(1)) {
        expect(envelope.connections).toEqual([master]);
      }
    });

    it('loops one shared second of noise for every noise tone', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      expect(context.buffers).toHaveLength(1);
      expect(context.buffers[0]?.length).toBe(context.sampleRate);
      const noise = context.bufferSources[0];
      expect(noise?.loop).toBe(true);
      expect(noise?.buffer).toBe(context.buffers[0]);
      expect(noise?.started).toEqual([10 + OFFSET + 0.1]);
    });
  });

  describe('effects', () => {
    it('adds no bit-crush or delay node when the plan has none', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      expect(context.shapers).toHaveLength(0);
      expect(context.delays).toHaveLength(0);
    });

    it('puts a bit-crush shaper between the master and the destination', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf({ ...BASE, effects: { bitcrush: { bits: 4 } } }));
      const shaper = context.shapers[0];
      expect(new Set(shaper?.curve).size).toBe(16);
      expect(context.gains[0]?.connections).toEqual([shaper]);
      expect(shaper?.connections).toEqual([context.destination]);
    });

    it('adds a feedback delay branch mixed in by a wet gain', async () => {
      const { context, renderer } = setup();
      const effects = { delay: { timeSec: 0.2, feedback: 0.4, mix: 0.3 } };
      await renderer.play(planOf({ ...BASE, effects }));
      const delay = context.delays[0];
      expect(delay?.delayTime.value).toBe(0.2);
      const master = context.gains[0];
      // The dry path still reaches the destination; the delay is a branch.
      expect(master?.connections).toEqual([context.destination, delay]);
      const feedback = context.gains.find((gain) => gain.gain.value === 0.4);
      const wet = context.gains.find((gain) => gain.gain.value === 0.3);
      expect(delay?.connections).toEqual([feedback, wet]);
      expect(feedback?.connections).toEqual([delay]);
      expect(wet?.connections).toEqual([context.destination]);
    });
  });

  describe('context lifecycle', () => {
    it('creates the context once across two plays', async () => {
      const { createContext, renderer } = setup();
      await renderer.play(planOf());
      await renderer.play(planOf());
      expect(createContext).toHaveBeenCalledTimes(1);
    });

    it('resumes a suspended context before any source starts', async () => {
      const { context, renderer } = setup({ suspended: true });
      await renderer.play(planOf());
      expect(context.log[0]).toBe('resume');
      expect(context.log.slice(1).every((entry) => entry.startsWith('start:'))).toBe(true);
    });

    it('does not create a context for an empty plan', async () => {
      const { createContext, renderer } = setup();
      const result = await renderer.play(planOf(BASE, 0));
      expect(result.ok).toBe(true);
      expect(createContext).not.toHaveBeenCalled();
    });

    it('returns an error, without throwing, when the factory throws', async () => {
      const renderer = createWebAudioRenderer(() => {
        throw new Error('no audio');
      }, createLogger('test'));
      const result = await renderer.play(planOf());
      expect(result.ok).toBe(false);
    });

    it('retries creating the context after a failure', async () => {
      const context = new FakeAudioContext();
      let calls = 0;
      const renderer = createWebAudioRenderer(() => {
        calls += 1;
        if (calls === 1) throw new Error('no audio');
        return context;
      }, createLogger('test'));
      expect((await renderer.play(planOf())).ok).toBe(false);
      expect((await renderer.play(planOf())).ok).toBe(true);
    });

    it('returns an error when resume fails', async () => {
      const context = new FakeAudioContext({ suspended: true });
      context.resume = () => Promise.reject(new Error('blocked'));
      const renderer = createWebAudioRenderer(() => context, createLogger('test'));
      const result = await renderer.play(planOf());
      expect(result.ok).toBe(false);
      expect(context.oscillators).toHaveLength(0);
    });
  });

  describe('stopAll and dispose', () => {
    it('stops every started source immediately', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      renderer.stopAll();
      const sources = [...context.oscillators, ...context.bufferSources];
      expect(sources.length).toBe(5);
      for (const source of sources) {
        expect(source.stopped.at(-1)).toBe(0);
      }
    });

    it('forgets a source once it has ended', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      const ended = context.oscillators[0];
      ended?.onended?.();
      renderer.stopAll();
      expect(ended?.stopped).toHaveLength(1);
    });

    it('closes the context exactly once', async () => {
      const { context, renderer } = setup();
      await renderer.play(planOf());
      await renderer.dispose();
      await renderer.dispose();
      expect(context.closeCalls).toBe(1);
    });

    it('logs, and does not throw, when the context fails to close', async () => {
      const context = new FakeAudioContext();
      context.close = () => Promise.reject(new Error('already closed'));
      const sink = vi.fn();
      const renderer = createWebAudioRenderer(
        () => context,
        createLogger('test', { sink, minLevel: 'warn' }),
      );
      await renderer.play(planOf());
      await expect(renderer.dispose()).resolves.toBeUndefined();
      expect(sink).toHaveBeenCalledTimes(1);
    });

    it('does nothing when disposed before any play', async () => {
      const { createContext, renderer } = setup();
      await renderer.dispose();
      expect(createContext).not.toHaveBeenCalled();
    });

    it('creates a fresh context when played again after dispose', async () => {
      const { createContext, renderer } = setup();
      await renderer.play(planOf());
      await renderer.dispose();
      await renderer.play(planOf());
      expect(createContext).toHaveBeenCalledTimes(2);
    });
  });
});
