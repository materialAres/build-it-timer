import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/entrypoints/background';
import { onMessage, sendMessage } from '@/lib/messaging/bus';
import { END_SOUND_MAX_LATENESS_MS } from '@/lib/sound/sound-cues';
import type { SoundPlayer, SoundPlayRequest } from '@/lib/sound/sound-player';
import { DEFAULT_FOCUS_PRESET } from '@/lib/timer/focus-presets';
import { createAppStore, STORE_NAME } from '@/store';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { ok } from '@/utils/result';

const T0 = 1_700_000_000_000;
const SESSION_MS = DEFAULT_FOCUS_PRESET.durationSeconds * 1000;
const MINUTE = 60_000;

/**
 * M5.T15 — the background plays the start sound on a fresh start and the end
 * sound on a natural completion, never on anything else.
 */
describe('sound cues in the background (M5.T15)', () => {
  let now: number;
  let alarmProvider: FakeAlarmProvider;
  let played: SoundPlayRequest[];
  let player: SoundPlayer;

  beforeEach(() => {
    fakeBrowser.reset();
    now = T0;
    alarmProvider = new FakeAlarmProvider(T0);
    played = [];
    player = {
      play(request) {
        played.push(request);
        return Promise.resolve(ok(undefined));
      },
    };
  });

  function startWired() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => now, random: () => 0.5 },
    });
    const handle = startBackground({
      store,
      alarmProvider,
      now: () => now,
      soundPlayer: player,
    });
    return { store, handle };
  }

  /** Let the clock reach `endsAt + lateness`, then fire the session alarm. */
  function completeSession(lateness: number): void {
    now = T0 + SESSION_MS + lateness;
    alarmProvider.advanceBy(SESSION_MS + lateness);
  }

  const cues = (): string[] => played.map((request) => request.cue);

  describe('start sound', () => {
    it('plays once on a fresh start', async () => {
      const { handle } = startWired();
      await handle.ready;

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(played).toEqual([{ themeId: 'glitch', cue: 'start', volume: 50 }]);
      handle.dispose();
    });

    it('plays nothing when the session is resumed after a pause', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(cues()).toEqual(['start']);
      handle.dispose();
    });

    it('plays nothing for a start request while already running', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(cues()).toEqual(['start']);
      handle.dispose();
    });

    it('plays again for the next fresh session after a reset', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });
      await sendMessage({ type: 'TIMER_RESET', payload: {} });

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(cues()).toEqual(['start', 'start']);
      handle.dispose();
    });
  });

  describe('end sound', () => {
    it('plays once when the alarm fires on time', async () => {
      const { store, handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      completeSession(0);

      expect(cues()).toEqual(['start', 'end']);
      expect(store.getState().timer.status).toBe('completed');
      handle.dispose();
    });

    it('still completes the session, silently, when the alarm is 2 minutes late', async () => {
      const { store, handle } = startWired();
      await handle.ready;
      const ended = vi.fn();
      onMessage('SESSION_ENDED', ended);
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      completeSession(2 * MINUTE);

      expect(cues()).toEqual(['start']);
      expect(store.getState().timer.status).toBe('completed');
      expect(store.getState().sessionHistory.sessions).toHaveLength(1);
      expect(ended).toHaveBeenCalledTimes(1);
      handle.dispose();
    });

    it('plays when the alarm is exactly 60 s late', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      completeSession(END_SOUND_MAX_LATENESS_MS);

      expect(cues()).toEqual(['start', 'end']);
      handle.dispose();
    });

    it('stays silent when the alarm is 60.001 s late', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      completeSession(END_SOUND_MAX_LATENESS_MS + 1);

      expect(cues()).toEqual(['start']);
      handle.dispose();
    });
  });

  describe('startup catch-up', () => {
    /**
     * Start a session, stop the worker, then restart it with the clock `late`
     * ms after the deadline while the alarm is still pending (the browser could
     * not fire it): the startup reconciliation closes the session.
     */
    async function restartAfterDeadline(late: number) {
      const first = startWired();
      await first.handle.ready;
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });
      await vi.waitFor(async () => {
        const raw = await fakeBrowser.storage.local.get(STORE_NAME);
        expect(raw[STORE_NAME]).toBeTypeOf('string');
      });
      first.handle.dispose();
      played.length = 0;

      now = T0 + SESSION_MS + late;
      const second = startWired();
      await second.handle.ready;
      return second;
    }

    it('plays the end sound once when the deadline passed less than 60 s ago', async () => {
      const { store, handle } = await restartAfterDeadline(30_000);

      expect(store.getState().timer.status).toBe('completed');
      expect(cues()).toEqual(['end']);
      handle.dispose();
    });

    it('completes silently when the deadline passed long ago', async () => {
      const { store, handle } = await restartAfterDeadline(5 * MINUTE);

      expect(store.getState().timer.status).toBe('completed');
      expect(cues()).toEqual([]);
      handle.dispose();
    });
  });

  describe('preferences', () => {
    it('plays nothing at all when sounds are disabled', async () => {
      const { store, handle } = startWired();
      await handle.ready;
      store.getState().setSoundPreferences({ enabled: false });

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });
      completeSession(0);

      expect(played).toEqual([]);
      expect(store.getState().timer.status).toBe('completed');
      handle.dispose();
    });

    it('uses the theme and volume stored at the time of each cue', async () => {
      const { store, handle } = startWired();
      await handle.ready;
      store.getState().setSoundPreferences({ themeId: 'glitch', volume: 70 });
      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      store.getState().setSoundPreferences({ themeId: 'terminal', volume: 20 });
      completeSession(0);

      expect(played).toEqual([
        { themeId: 'glitch', cue: 'start', volume: 70 },
        { themeId: 'terminal', cue: 'end', volume: 20 },
      ]);
      handle.dispose();
    });

    it('applies a preferences change sent through the bus', async () => {
      const { handle } = startWired();
      await handle.ready;
      await sendMessage({
        type: 'PREFERENCES_SOUND_SET',
        payload: { themeId: 'synthwave' },
      });

      await sendMessage({ type: 'TIMER_STARTED', payload: {} });

      expect(played[0]?.themeId).toBe('synthwave');
      handle.dispose();
    });
  });

  describe('everything else is silent', () => {
    it('never plays for pause, reset, a duration change, a blocklist or a preferences change', async () => {
      const { handle } = startWired();
      await handle.ready;

      await sendMessage({
        type: 'TIMER_SET_DURATION',
        payload: { durationSeconds: DEFAULT_FOCUS_PRESET.durationSeconds },
      });
      await sendMessage({
        type: 'BLOCKLIST_ADD_SITE',
        payload: { site: 'facebook.com' },
      });
      await sendMessage({
        type: 'PREFERENCES_SOUND_SET',
        payload: { volume: 90 },
      });
      await sendMessage({ type: 'TIMER_PAUSED', payload: {} });
      await sendMessage({ type: 'TIMER_RESET', payload: {} });

      expect(played).toEqual([]);
      handle.dispose();
    });
  });
});
