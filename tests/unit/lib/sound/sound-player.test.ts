import { describe, expect, it } from 'vitest';
import { MUTATION_TYPES, type RuntimeMessage } from '@/lib/messaging/messages.types';
import { calculatePlaybackPlan, type PlaybackPlan } from '@/lib/sound/playback-plan';
import {
  createDirectSoundPlayer,
  createSilentSoundPlayer,
  isSoundPlayRequest,
  type SoundPlayRequest,
} from '@/lib/sound/sound-player';
import { SOUND_THEMES, findSoundTheme } from '@/lib/sound/sound-themes';
import type { SoundCue } from '@/lib/sound/sound.types';
import type { SoundRenderer } from '@/lib/sound/web-audio-renderer';
import { err, ok, type Result } from '@/utils/result';

const CUES: ReadonlyArray<SoundCue> = ['start', 'end'];

function fakeRenderer(behavior: () => Promise<Result<void>> = () =>
  Promise.resolve(ok(undefined))) {
  const plans: PlaybackPlan[] = [];
  const renderer: SoundRenderer = {
    play(plan) {
      plans.push(plan);
      return behavior();
    },
    stopAll: () => undefined,
    dispose: () => Promise.resolve(),
  };
  return { renderer, plans };
}

const NEON_END: SoundPlayRequest = { themeId: 'neon', cue: 'end', volume: 50 };

describe('createDirectSoundPlayer', () => {
  it('renders the plan of the requested theme, cue and volume', async () => {
    const { renderer, plans } = fakeRenderer();
    const result = await createDirectSoundPlayer(renderer).play(NEON_END);

    expect(result.ok).toBe(true);
    expect(plans).toEqual([
      calculatePlaybackPlan(findSoundTheme('neon').end, 50),
    ]);
  });

  it.each(SOUND_THEMES.flatMap((theme) => CUES.map((cue) => [theme.id, cue] as const)))(
    'plays %s %s',
    async (themeId, cue) => {
      const { renderer, plans } = fakeRenderer();
      await createDirectSoundPlayer(renderer).play({ themeId, cue, volume: 100 });
      expect(plans).toEqual([
        calculatePlaybackPlan(findSoundTheme(themeId)[cue], 100),
      ]);
    },
  );

  it('renders nothing and returns ok at volume 0', async () => {
    const { renderer, plans } = fakeRenderer();
    const result = await createDirectSoundPlayer(renderer).play({
      ...NEON_END,
      volume: 0,
    });
    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(0);
  });

  it.each([
    ['an unknown theme', { ...NEON_END, themeId: 'bogus' }],
    ['the cue pause', { ...NEON_END, cue: 'pause' }],
    ['a negative volume', { ...NEON_END, volume: -1 }],
    ['a volume above 100', { ...NEON_END, volume: 101 }],
    ['a fractional volume', { ...NEON_END, volume: 2.5 }],
    ['a string volume', { ...NEON_END, volume: '50' }],
    ['null', null],
  ])('returns an error without rendering for %s', async (_label, request) => {
    const { renderer, plans } = fakeRenderer();
    const result = await createDirectSoundPlayer(renderer).play(
      request as unknown as SoundPlayRequest,
    );
    expect(result.ok).toBe(false);
    expect(plans).toHaveLength(0);
  });

  it('returns the error of a renderer that fails', async () => {
    const failure = new Error('no audio');
    const { renderer } = fakeRenderer(() => Promise.resolve(err(failure)));
    const result = await createDirectSoundPlayer(renderer).play(NEON_END);
    expect(result).toEqual({ ok: false, error: failure });
  });

  it('turns a rejecting renderer into an error result', async () => {
    const { renderer } = fakeRenderer(() => Promise.reject(new Error('boom')));
    const result = await createDirectSoundPlayer(renderer).play(NEON_END);
    expect(result.ok).toBe(false);
  });

  it('turns a throwing renderer into an error result', async () => {
    const { renderer } = fakeRenderer(() => {
      throw new Error('boom');
    });
    const result = await createDirectSoundPlayer(renderer).play(NEON_END);
    expect(result.ok).toBe(false);
  });
});

describe('createSilentSoundPlayer', () => {
  it('always returns ok and plays nothing', async () => {
    const player = createSilentSoundPlayer();
    await expect(player.play(NEON_END)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(
      player.play(null as unknown as SoundPlayRequest),
    ).resolves.toEqual({ ok: true, value: undefined });
  });
});

describe('isSoundPlayRequest', () => {
  it.each(SOUND_THEMES.flatMap((theme) => CUES.map((cue) => [theme.id, cue] as const)))(
    'accepts %s %s at the volume bounds',
    (themeId, cue) => {
      expect(isSoundPlayRequest({ themeId, cue, volume: 0 })).toBe(true);
      expect(isSoundPlayRequest({ themeId, cue, volume: 100 })).toBe(true);
    },
  );

  it.each([
    ['a string', 'neon'],
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a missing field', { themeId: 'neon', cue: 'end' }],
    ['an unknown theme', { ...NEON_END, themeId: 'NEON' }],
    ['the cue pause', { ...NEON_END, cue: 'pause' }],
    ['volume -1', { ...NEON_END, volume: -1 }],
    ['volume 101', { ...NEON_END, volume: 101 }],
    ['volume 2.5', { ...NEON_END, volume: 2.5 }],
    ['volume "50"', { ...NEON_END, volume: '50' }],
    ['volume NaN', { ...NEON_END, volume: Number.NaN }],
  ])('rejects %s', (_label, value) => {
    expect(isSoundPlayRequest(value)).toBe(false);
  });
});

describe('PLAY_SOUND message', () => {
  it('carries a SoundPlayRequest and is not a mutation', () => {
    const message: RuntimeMessage = { type: 'PLAY_SOUND', payload: NEON_END };
    expect(message.type).toBe('PLAY_SOUND');
    expect((MUTATION_TYPES as ReadonlyArray<string>).includes(message.type)).toBe(
      false,
    );
  });
});
