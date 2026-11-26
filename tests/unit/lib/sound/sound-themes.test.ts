import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_THEME_ID,
  SOUND_THEMES,
  findSoundTheme,
  isSoundThemeId,
} from '@/lib/sound/sound-themes';
import type { SoundCue, SoundRecipe } from '@/lib/sound/sound.types';

const CUES: ReadonlyArray<SoundCue> = ['start', 'end'];
const MAX_RECIPE_SECONDS = 1.5;

interface Timed {
  readonly startSec: number;
  readonly durationSec: number;
}

function timedItems(voice: SoundRecipe['voices'][number]): ReadonlyArray<Timed> {
  return voice.kind === 'oscillator' ? voice.notes : voice.bursts;
}

function frequenciesOf(recipe: SoundRecipe): number[] {
  const frequencies: number[] = [];
  for (const voice of recipe.voices) {
    if (voice.kind === 'oscillator') {
      for (const note of voice.notes) {
        frequencies.push(note.frequencyHz);
        if (note.glideToHz !== undefined) frequencies.push(note.glideToHz);
      }
    }
    if (voice.filter) frequencies.push(voice.filter.fromHz, voice.filter.toHz);
  }
  return frequencies;
}

const RECIPES: ReadonlyArray<readonly [string, SoundRecipe]> = SOUND_THEMES.flatMap(
  (theme) => CUES.map((cue) => [`${theme.id}.${cue}`, theme[cue]] as const),
);

describe('SOUND_THEMES', () => {
  it('has exactly the four themes, in order, with unique ids', () => {
    expect(SOUND_THEMES.map((theme) => theme.id)).toEqual([
      'neon',
      'synthwave',
      'glitch',
      'terminal',
    ]);
  });

  it('has 8 recipes to check (4 themes x start/end)', () => {
    expect(RECIPES).toHaveLength(8);
  });
});

describe('DEFAULT_SOUND_THEME_ID / findSoundTheme', () => {
  it('defaults to a theme that exists', () => {
    expect(SOUND_THEMES.map((theme) => theme.id)).toContain(DEFAULT_SOUND_THEME_ID);
    expect(DEFAULT_SOUND_THEME_ID).toBe('glitch');
  });

  it.each(SOUND_THEMES.map((theme) => theme.id))('finds %s', (id) => {
    expect(findSoundTheme(id).id).toBe(id);
  });
});

describe('isSoundThemeId', () => {
  it.each(['neon', 'synthwave', 'glitch', 'terminal'])('accepts %s', (value) => {
    expect(isSoundThemeId(value)).toBe(true);
  });

  it.each(['NEON', '', 1, null, undefined, {}])('rejects %j', (value) => {
    expect(isSoundThemeId(value)).toBe(false);
  });
});

describe.each(RECIPES)('recipe %s', (_name, recipe) => {
  it('has at least one voice', () => {
    expect(recipe.voices.length).toBeGreaterThan(0);
  });

  it('keeps every frequency between 20 and 20000 Hz', () => {
    for (const hz of frequenciesOf(recipe)) {
      expect(hz).toBeGreaterThanOrEqual(20);
      expect(hz).toBeLessThanOrEqual(20_000);
    }
  });

  it('keeps each gain in (0, 1] and the sum at most 1', () => {
    let sum = 0;
    for (const voice of recipe.voices) {
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.gain).toBeLessThanOrEqual(1);
      sum += voice.gain;
    }
    expect(sum).toBeLessThanOrEqual(1);
  });

  it('ends every note and burst within 1.5 s, release included', () => {
    for (const voice of recipe.voices) {
      for (const item of timedItems(voice)) {
        const end = item.startSec + item.durationSec + voice.envelope.releaseSec;
        expect(end).toBeLessThanOrEqual(MAX_RECIPE_SECONDS);
      }
    }
  });

  it('has positive attack and release', () => {
    for (const voice of recipe.voices) {
      expect(voice.envelope.attackSec).toBeGreaterThan(0);
      expect(voice.envelope.releaseSec).toBeGreaterThan(0);
    }
  });

  it('keeps effect parameters in range', () => {
    const { bitcrush, delay } = recipe.effects;
    if (bitcrush) {
      expect(Number.isInteger(bitcrush.bits)).toBe(true);
      expect(bitcrush.bits).toBeGreaterThanOrEqual(2);
      expect(bitcrush.bits).toBeLessThanOrEqual(8);
    }
    if (delay) {
      expect(delay.feedback).toBeGreaterThanOrEqual(0);
      expect(delay.feedback).toBeLessThan(0.8);
      expect(delay.mix).toBeGreaterThanOrEqual(0);
      expect(delay.mix).toBeLessThanOrEqual(1);
    }
  });
});
