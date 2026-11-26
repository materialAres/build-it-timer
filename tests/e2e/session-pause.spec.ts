import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  configure,
  launchHarness,
  openPopup,
  playedSounds,
  readState,
  startSession,
  type Harness,
} from './session-helpers';
import { EXTENSION_PATH } from './setup';

/**
 * Pause and resume with a blocked tab left open (about a minute). Part of the
 * default `bun run e2e`; the whole-session tests are in `session-long.spec.ts`.
 * The sound that played is read from the `PLAY_SOUND` messages the background
 * sends (see `session-helpers.ts`).
 */
test.skip(!existsSync(EXTENSION_PATH), 'Build the extension first: bun run build');
test.setTimeout(3 * 60_000);

let harness: Harness | undefined;

test.afterEach(async () => {
  await harness?.context.close();
  harness = undefined;
});

test.describe('pause and resume (M5)', () => {
  // the time spent on a blocked tab that stays open stops costing
  // while the timer is paused, and resuming is not a new session (no new sound).
  test('pause freezes the malus on an open blocked tab; resume plays no second start sound', async () => {
    const h = await launchHarness();
    harness = h;
    await configure(h, { social: true });
    await startSession(h);
    const tab = await h.context.newPage();
    await tab.goto('https://facebook.com/');
    await h.spy.waitForTimeout(10_000);

    const popup = await openPopup(h);
    await popup.getByRole('button', { name: 'Pause' }).click();
    await expect.poll(async () => (await readState(h.spy)).timer.status).toBe('paused');
    const paused = await readState(h.spy);
    expect(paused.timer.distractedMs).toBeGreaterThan(7_000);

    await h.spy.waitForTimeout(15_000);
    const stillPaused = await readState(h.spy);
    expect(stillPaused.timer.distractedMs - paused.timer.distractedMs).toBeLessThan(1_500);
    expect(stillPaused.timer.focusedMs - paused.timer.focusedMs).toBeLessThan(1_500);
    expect(stillPaused.score.builtCharacters).toBe(paused.score.builtCharacters);

    await popup.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(async () => (await readState(h.spy)).timer.status).toBe('running');
    await h.spy.waitForTimeout(6_000);
    const resumed = await readState(h.spy);
    // The tab never closed: the malus runs again, and the focus clock does not.
    expect(resumed.timer.distractedMs - stillPaused.timer.distractedMs).toBeGreaterThan(4_000);
    expect(resumed.timer.focusedMs - stillPaused.timer.focusedMs).toBeLessThan(2_000);
    expect(await playedSounds(h.spy)).toEqual([{ themeId: 'glitch', cue: 'start', volume: 50 }]);

    await popup.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(async () => (await readState(h.spy)).timer.status).toBe('idle');
  });
});
