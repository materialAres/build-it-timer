import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import { listenForPlaySound } from '@/lib/sound/play-sound-listener';
import type { SoundPlayer, SoundPlayRequest } from '@/lib/sound/sound-player';
import { createLogger, type LogRecord } from '@/utils/logger';
import { err, ok, type Result } from '@/utils/result';

const REQUEST: SoundPlayRequest = { themeId: 'neon', cue: 'start', volume: 50 };
const MESSAGE: RuntimeMessage = { type: 'PLAY_SOUND', payload: REQUEST };

function setup(behavior: () => Promise<Result<void>> = () =>
  Promise.resolve(ok(undefined))) {
  const played: SoundPlayRequest[] = [];
  const player: SoundPlayer = {
    play(request) {
      played.push(request);
      return behavior();
    },
  };
  const records: LogRecord[] = [];
  const logger = createLogger('test', {
    sink: (record) => records.push(record),
    minLevel: 'debug',
  });
  const dispose = listenForPlaySound(player, logger);
  return { played, records, dispose };
}

describe('listenForPlaySound (M5.T11)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('plays a valid PLAY_SOUND once, with its payload', async () => {
    const { played } = setup();
    await sendMessage(MESSAGE);
    expect(played).toEqual([REQUEST]);
  });

  it.each([
    ['an unknown theme', { ...REQUEST, themeId: 'bogus' }],
    ['the cue pause', { ...REQUEST, cue: 'pause' }],
    ['a volume above 100', { ...REQUEST, volume: 500 }],
    ['a null payload', null],
  ])('ignores %s and logs a warning with the type only', async (_label, payload) => {
    const { played, records } = setup();

    await sendMessage({ type: 'PLAY_SOUND', payload } as unknown as RuntimeMessage);

    expect(played).toHaveLength(0);
    const warnings = records.filter((record) => record.level === 'warn');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.details).toEqual([{ type: 'PLAY_SOUND' }]);
  });

  it('logs an error when the player reports a failure, without throwing', async () => {
    const failure = new Error('no audio');
    const { records } = setup(() => Promise.resolve(err(failure)));

    await expect(sendMessage(MESSAGE)).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    await vi.waitFor(() => {
      const errors = records.filter((record) => record.level === 'error');
      expect(errors).toHaveLength(1);
      expect(errors[0]?.details[0]).toBe(failure);
    });
  });

  it('contains a player that rejects', async () => {
    const { records } = setup(() => Promise.reject(new Error('boom')));

    await expect(sendMessage(MESSAGE)).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    await vi.waitFor(() => {
      expect(records.some((record) => record.level === 'error')).toBe(true);
    });
  });

  it('ignores messages of other types', async () => {
    const { played, records } = setup();
    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1 } });
    expect(played).toHaveLength(0);
    expect(records).toHaveLength(0);
  });

  it('stops listening once the disposer has run', async () => {
    const { played, dispose } = setup();
    dispose();
    await sendMessage(MESSAGE);
    expect(played).toHaveLength(0);
  });
});
