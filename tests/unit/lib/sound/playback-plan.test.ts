import { describe, expect, it } from 'vitest';
import {
  calculatePlaybackPlan,
  calculateVolumeGain,
} from '@/lib/sound/playback-plan';
import { SOUND_THEMES } from '@/lib/sound/sound-themes';
import type { SoundRecipe } from '@/lib/sound/sound.types';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const RECIPE: SoundRecipe = deepFreeze({
  voices: [
    {
      kind: 'oscillator',
      waveform: 'sawtooth',
      detuneCents: [-8, 8],
      gain: 0.3,
      envelope: { attackSec: 0.01, releaseSec: 0.2 },
      notes: [
        { frequencyHz: 440, startSec: 0, durationSec: 0.1 },
        { frequencyHz: 880, glideToHz: 220, startSec: 0.1, durationSec: 0.3 },
      ],
      filter: { type: 'lowpass', fromHz: 600, toHz: 5000, q: 6 },
    },
    {
      kind: 'noise',
      gain: 0.2,
      envelope: { attackSec: 0.002, releaseSec: 0.05 },
      bursts: [{ startSec: 0.5, durationSec: 0.1 }],
    },
  ],
  effects: {},
});

describe('calculateVolumeGain', () => {
  it.each([
    [0, 0],
    [50, 0.25],
    [100, 1],
    [150, 1],
    [-5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('maps volume %s to %s', (volume, gain) => {
    expect(calculateVolumeGain(volume)).toBe(gain);
  });
});

describe('calculatePlaybackPlan', () => {
  it('plans one oscillator tone per note and detune value, and one per burst', () => {
    const plan = calculatePlaybackPlan(RECIPE, 100);
    const oscillators = plan.tones.filter((tone) => tone.kind === 'oscillator');
    const noise = plan.tones.filter((tone) => tone.kind === 'noise');
    expect(oscillators).toHaveLength(4);
    expect(noise).toHaveLength(1);
  });

  it('copies timing, gain, envelope, pitch and filter into each tone', () => {
    const plan = calculatePlaybackPlan(RECIPE, 100);
    expect(plan.tones[0]).toEqual({
      kind: 'oscillator',
      waveform: 'sawtooth',
      frequencyHz: 440,
      detuneCents: -8,
      startSec: 0,
      durationSec: 0.1,
      peakGain: 0.3,
      attackSec: 0.01,
      releaseSec: 0.2,
      filter: { type: 'lowpass', fromHz: 600, toHz: 5000, q: 6 },
    });
    expect(plan.tones[2]).toMatchObject({
      frequencyHz: 880,
      glideToHz: 220,
      detuneCents: -8,
      startSec: 0.1,
    });
    expect(plan.tones[4]).toEqual({
      kind: 'noise',
      startSec: 0.5,
      durationSec: 0.1,
      peakGain: 0.2,
      attackSec: 0.002,
      releaseSec: 0.05,
    });
  });

  it('sets the master gain from the volume', () => {
    expect(calculatePlaybackPlan(RECIPE, 50).masterGain).toBe(0.25);
  });

  it.each([0, -1, Number.NaN])('plans nothing at volume %s', (volume) => {
    const plan = calculatePlaybackPlan(RECIPE, volume);
    expect(plan.tones).toEqual([]);
    expect(plan.durationSec).toBe(0);
    expect(plan.masterGain).toBe(0);
  });

  it('ends at the latest start + duration + release', () => {
    const plan = calculatePlaybackPlan(RECIPE, 100);
    // oscillator: 0.1 + 0.3 + 0.2 = 0.6; noise: 0.5 + 0.1 + 0.05 = 0.65
    expect(plan.durationSec).toBeCloseTo(0.65, 10);
  });

  it('adds a delay tail of four delay times', () => {
    const withDelay: SoundRecipe = {
      ...RECIPE,
      effects: { delay: { timeSec: 0.1, feedback: 0.3, mix: 0.3 } },
    };
    expect(calculatePlaybackPlan(withDelay, 100).durationSec).toBeCloseTo(1.05, 10);
  });

  it('passes the effects through', () => {
    const crushed: SoundRecipe = { ...RECIPE, effects: { bitcrush: { bits: 4 } } };
    expect(calculatePlaybackPlan(crushed, 100).effects).toEqual({
      bitcrush: { bits: 4 },
    });
  });

  it('is pure: same input, same output, input not mutated', () => {
    const first = calculatePlaybackPlan(RECIPE, 70);
    const second = calculatePlaybackPlan(RECIPE, 70);
    expect(second).toEqual(first);
  });

  it('gives every real theme recipe a non-empty plan of at most 2.5 s', () => {
    for (const theme of SOUND_THEMES) {
      for (const recipe of [theme.start, theme.end]) {
        const plan = calculatePlaybackPlan(recipe, 100);
        expect(plan.tones.length).toBeGreaterThan(0);
        expect(plan.durationSec).toBeGreaterThan(0);
        expect(plan.durationSec).toBeLessThanOrEqual(2.5);
      }
    }
  });
});
