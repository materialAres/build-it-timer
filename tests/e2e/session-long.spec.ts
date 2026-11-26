import { test, expect } from '@playwright/test';
import {
  SOUND_LABEL,
  configure,
  launchHarness,
  openPopup,
  playedSounds,
  readState,
  startSession,
  visitBlockedSite,
  waitForCompletion,
  type Harness,
} from './session-helpers';
import { existsSync } from 'node:fs';
import { EXTENSION_PATH } from './setup';

/**
 * Whole focus sessions on the built extension, in real time: a 5-minute session
 * lasts 5 minutes. They are left out of `bun run e2e`; run them with
 * `bun run e2e:sessions` (in parallel, about 6 minutes). Playwright cannot hear:
 * the sound that played is read from the `PLAY_SOUND` messages the background
 * sends (see `session-helpers.ts`). A
 * session earns 2 characters a second (600 in 300 s), so these tests assert
 * ranges around that rate, never exact counts.
 */
test.skip(!existsSync(EXTENSION_PATH), 'Build the extension first: bun run build');
test.setTimeout(9 * 60_000);

const play = (themeId: string, cue: string, volume: number) => ({ themeId, cue, volume });
let harness: Harness | undefined;

test.afterEach(async () => {
  await harness?.context.close();
  harness = undefined;
});

test.describe('whole sessions (M5)', () => {
  test('a clean 5-minute session with the default sound builds the whole city', async () => {
    const h = await launchHarness();
    harness = h;
    await configure(h);
    // Nothing chosen: the default is the Glitch pair at 50%.
    expect((await readState(h.spy)).preferences.sound).toEqual({ enabled: true, themeId: 'glitch', volume: 50 });
    const startedAt = await startSession(h);

    // With the popup closed the background saves progress on its 60 s alarm, so
    // the stored count moves once a minute: ~120 characters after the first one.
    await expect
      .poll(async () => (await readState(h.spy)).score.builtCharacters, { timeout: 100_000, intervals: [2_000] })
      .toBeGreaterThan(100);
    const early = (await readState(h.spy)).score.builtCharacters;
    await h.spy.waitForTimeout(65_000);
    expect((await readState(h.spy)).score.builtCharacters).toBeGreaterThan(early + 100);

    // The popup, reopened mid-session, shows the city that grew while it was closed.
    const popup = await openPopup(h);
    await popup.getByRole('tab', { name: 'City' }).click();
    await expect(popup.getByRole('status').filter({ hasText: /floors built/ })).toBeVisible();
    await popup.close();

    const final = await waitForCompletion(h, startedAt);
    expect(final.score.builtCharacters).toBeGreaterThanOrEqual(598);
    expect(final.score.level).toBe('excellent');
    expect(final.timer.distractedMs).toBe(0);
    await expect.poll(() => playedSounds(h.spy)).toEqual([play('glitch', 'start', 50), play('glitch', 'end', 50)]);
  });

  test('neon: a blocked site right at the start for 30 s costs characters', async () => {
    const h = await launchHarness();
    harness = h;
    await configure(h, { themeId: 'neon', social: true });
    const startedAt = await startSession(h);

    await visitBlockedSite(h, 'https://facebook.com/', 30_000);

    const final = await waitForCompletion(h, startedAt);
    // 30 s on the site = 60 malus ticks at 500 ms; the escalation (1, 2, then 3
    // characters a tick) makes that about 164 characters off ~540 earned.
    expect(final.timer.distractedMs).toBeGreaterThan(27_000);
    expect(final.timer.distractedMs).toBeLessThan(36_000);
    expect(final.timer.focusedMs).toBeGreaterThan(255_000);
    expect(final.score.builtCharacters).toBeGreaterThan(340);
    expect(final.score.builtCharacters).toBeLessThan(415);
    expect(final.score.level).toBe('good');
    await expect.poll(() => playedSounds(h.spy)).toEqual([play('neon', 'start', 50), play('neon', 'end', 50)]);
  });

  test('terminal at 75%: a blocked site after 2 minutes for 30 s costs the same', async () => {
    const h = await launchHarness();
    harness = h;
    await configure(h, { themeId: 'terminal', volume: 75, site: 'example.com' });
    const startedAt = await startSession(h);

    await h.spy.waitForTimeout(120_000);
    const before = (await readState(h.spy)).score.builtCharacters;
    expect(before).toBeGreaterThan(200);
    await visitBlockedSite(h, 'https://example.com/', 30_000);

    const final = await waitForCompletion(h, startedAt);
    expect(final.timer.distractedMs).toBeGreaterThan(27_000);
    expect(final.timer.distractedMs).toBeLessThan(36_000);
    expect(final.score.builtCharacters).toBeGreaterThan(340);
    expect(final.score.builtCharacters).toBeLessThan(415);
    expect(final.score.level).toBe('good');
    await expect
      .poll(() => playedSounds(h.spy))
      .toEqual([play('terminal', 'start', 75), play('terminal', 'end', 75)]);
  });

  // Edge case: the toggle is not locked during a session, and it is read when
  // the end sound is due, so switching sounds off mid-session silences the end.
  test('turning the sound off mid-session keeps the start sound and silences the end', async () => {
    const h = await launchHarness();
    harness = h;
    await configure(h);
    const startedAt = await startSession(h);
    await expect.poll(() => playedSounds(h.spy)).toEqual([play('glitch', 'start', 50)]);

    const popup = await openPopup(h);
    await popup.getByRole('tab', { name: 'Settings' }).click();
    await popup.getByRole('checkbox', { name: SOUND_LABEL }).click();
    await expect.poll(async () => (await readState(h.spy)).preferences.sound.enabled).toBe(false);
    await popup.close();

    const final = await waitForCompletion(h, startedAt);
    expect(final.score.builtCharacters).toBeGreaterThanOrEqual(598);
    // Time for a (wrongly) late sound to arrive; there must be none.
    await h.spy.waitForTimeout(5_000);
    expect(await playedSounds(h.spy)).toEqual([play('glitch', 'start', 50)]);
  });
});
