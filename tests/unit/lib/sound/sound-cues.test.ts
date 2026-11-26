import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SOUND_PREFERENCES,
  type SoundPreferences,
} from '@/lib/sound/sound-preferences';
import {
  END_SOUND_MAX_LATENESS_MS,
  createSoundCues,
  shouldPlayEndSound,
} from '@/lib/sound/sound-cues';
import type { SoundPlayer, SoundPlayRequest } from '@/lib/sound/sound-player';
import { createLogger, type LogRecord } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';

const ENDS_AT = 1_800_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('END_SOUND_MAX_LATENESS_MS', () => {
  it('is 60 seconds', () => {
    expect(END_SOUND_MAX_LATENESS_MS).toBe(60_000);
  });
});

describe('shouldPlayEndSound', () => {
  it.each([
    ['on time', 0, true],
    ['3 s late', 3 * SECOND, true],
    ['exactly 60 s late', 60 * SECOND, true],
    ['60.001 s late', 60 * SECOND + 1, false],
    ['20 min late', 20 * MINUTE, false],
    ['18 h late', 18 * HOUR, false],
    ['a little early', -2 * SECOND, true],
  ])('%s', (_label, lateness, expected) => {
    expect(shouldPlayEndSound(ENDS_AT, ENDS_AT + lateness)).toBe(expected);
  });

  it('is false when there is no end time', () => {
    expect(shouldPlayEndSound(null, ENDS_AT)).toBe(false);
  });
});

function setup(
  options: {
    preferences?: SoundPreferences;
    now?: number;
    play?: (request: SoundPlayRequest) => Promise<Result<void>>;
  } = {},
) {
  let preferences = options.preferences ?? DEFAULT_SOUND_PREFERENCES;
  let now = options.now ?? ENDS_AT;
  const played: SoundPlayRequest[] = [];
  const player: SoundPlayer = {
    play(request) {
      played.push(request);
      return options.play ? options.play(request) : Promise.resolve(ok(undefined));
    },
  };
  const records: LogRecord[] = [];
  const logger = createLogger('test', {
    sink: (record) => records.push(record),
    minLevel: 'debug',
  });
  const cues = createSoundCues({
    getPreferences: () => preferences,
    player,
    now: () => now,
    logger,
  });
  return {
    cues,
    played,
    records,
    setPreferences: (next: SoundPreferences): void => {
      preferences = next;
    },
    setNow: (next: number): void => {
      now = next;
    },
  };
}

describe('createSoundCues', () => {
  describe('sessionStarted', () => {
    it('plays the start cue with the theme and volume from the preferences', () => {
      const { cues, played } = setup({
        preferences: { enabled: true, themeId: 'glitch', volume: 80 },
      });
      cues.sessionStarted();
      expect(played).toEqual([{ themeId: 'glitch', cue: 'start', volume: 80 }]);
    });

    it('reads the preferences when called, not when created', () => {
      const { cues, played, setPreferences } = setup();
      setPreferences({ enabled: true, themeId: 'terminal', volume: 10 });
      cues.sessionStarted();
      expect(played).toEqual([{ themeId: 'terminal', cue: 'start', volume: 10 }]);
    });

    it.each([
      ['disabled', { ...DEFAULT_SOUND_PREFERENCES, enabled: false }],
      ['at volume 0', { ...DEFAULT_SOUND_PREFERENCES, volume: 0 }],
    ])('plays nothing when sounds are %s', (_label, preferences) => {
      const { cues, played } = setup({ preferences });
      cues.sessionStarted();
      cues.sessionCompleted(ENDS_AT);
      expect(played).toHaveLength(0);
    });
  });

  describe('sessionCompleted', () => {
    it.each([
      ['on time', 0, 1],
      ['3 s late', 3 * SECOND, 1],
      ['exactly 60 s late', 60 * SECOND, 1],
      ['60.001 s late', 60 * SECOND + 1, 0],
      ['20 min late', 20 * MINUTE, 0],
      ['18 h late', 18 * HOUR, 0],
    ])('%s', (_label, lateness, expectedCalls) => {
      const { cues, played } = setup({ now: ENDS_AT + lateness });
      cues.sessionCompleted(ENDS_AT);
      expect(played).toHaveLength(expectedCalls);
    });

    it('plays the end cue with the theme and volume from the preferences', () => {
      const { cues, played } = setup({
        preferences: { enabled: true, themeId: 'synthwave', volume: 35 },
      });
      cues.sessionCompleted(ENDS_AT);
      expect(played).toEqual([{ themeId: 'synthwave', cue: 'end', volume: 35 }]);
    });

    it('stays silent when the session has no end time', () => {
      const { cues, played } = setup();
      cues.sessionCompleted(null);
      expect(played).toHaveLength(0);
    });

    it('judges the lateness with the injected clock', () => {
      const { cues, played, setNow } = setup();
      setNow(ENDS_AT + 5 * MINUTE);
      cues.sessionCompleted(ENDS_AT);
      expect(played).toHaveLength(0);
      setNow(ENDS_AT + SECOND);
      cues.sessionCompleted(ENDS_AT);
      expect(played).toHaveLength(1);
    });

    it('never reads the system clock', () => {
      const spy = vi.spyOn(Date, 'now');
      const { cues } = setup();
      cues.sessionStarted();
      cues.sessionCompleted(ENDS_AT);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('failures', () => {
    it('logs a warning with the cue only when the player reports an error', async () => {
      const { cues, records } = setup({
        play: () => Promise.resolve(err(new Error('no audio'))),
      });

      cues.sessionStarted();

      await vi.waitFor(() => {
        const warnings = records.filter((record) => record.level === 'warn');
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.details).toEqual([{ cue: 'start' }]);
      });
    });

    it('catches a rejecting player', async () => {
      const { cues, records } = setup({
        play: () => Promise.reject(new Error('boom')),
      });

      expect(() => {
        cues.sessionCompleted(ENDS_AT);
      }).not.toThrow();

      await vi.waitFor(() => {
        const warnings = records.filter((record) => record.level === 'warn');
        expect(warnings[0]?.details).toEqual([{ cue: 'end' }]);
      });
    });

    it('catches a player that throws synchronously', async () => {
      const { cues, records } = setup({
        play: () => {
          throw new Error('boom');
        },
      });

      expect(() => {
        cues.sessionStarted();
      }).not.toThrow();

      await vi.waitFor(() => {
        expect(records.some((record) => record.level === 'warn')).toBe(true);
      });
    });

    it('logs nothing when the player succeeds', async () => {
      const { cues, played, records } = setup();
      cues.sessionStarted();
      await Promise.resolve();
      expect(played).toHaveLength(1);
      expect(records).toHaveLength(0);
    });
  });
});
