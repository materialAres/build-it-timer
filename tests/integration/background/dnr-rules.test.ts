import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser, type Browser } from 'wxt/browser';
import { startBackground } from '@/entrypoints/background';
import { sendMessage } from '@/lib/messaging/bus';
import { createBrowserRuleApplier } from '@/lib/blocking/apply-rules';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import { STORE_NAME } from '@/store';
import { timerAlarmName } from '@/lib/timer/session';

type DnrRule = Browser.declarativeNetRequest.Rule;
type UpdateRuleOptions = Browser.declarativeNetRequest.UpdateRuleOptions;

/**
 * `fakeBrowser` declares `declarativeNetRequest` but does not implement it (the
 * methods throw `MockNotImplementedError`), so the dynamic ruleset is modelled
 * here: `getDynamicRules` returns what is live and `updateDynamicRules` applies
 * the removals/additions and records the call. The production applier is then
 * exercised against the real browser object.
 *
 * The methods are replaced rather than spied on because both are overloaded
 * (promise + callback form), which makes `vi.spyOn(...).mockImplementation()`
 * resolve against the void-returning overload.
 */
const restorers: Array<() => void> = [];

function installDynamicRulesFake(): {
  readonly updates: UpdateRuleOptions[];
  liveRules(): DnrRule[];
} {
  const dnr = browser.declarativeNetRequest;
  const originalGetDynamicRules = dnr.getDynamicRules;
  const originalUpdateDynamicRules = dnr.updateDynamicRules;

  let live: DnrRule[] = [];
  const updates: UpdateRuleOptions[] = [];

  dnr.getDynamicRules = () => Promise.resolve([...live]);
  dnr.updateDynamicRules = (options: UpdateRuleOptions) => {
    updates.push(options);
    const removed = new Set(options.removeRuleIds ?? []);
    live = [...live.filter((rule) => !removed.has(rule.id)), ...(options.addRules ?? [])];
    return Promise.resolve();
  };

  restorers.push(() => {
    dnr.getDynamicRules = originalGetDynamicRules;
    dnr.updateDynamicRules = originalUpdateDynamicRules;
  });

  return { updates, liveRules: () => live };
}

/** Make every dynamic-rules call fail, to exercise the error boundary. */
function installFailingDynamicRules(): void {
  const dnr = browser.declarativeNetRequest;
  const original = dnr.getDynamicRules;

  dnr.getDynamicRules = () => Promise.reject(new Error('declarativeNetRequest unavailable'));

  restorers.push(() => {
    dnr.getDynamicRules = original;
  });
}

/** Let the asynchronous rule sync (queued microtasks) settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const BLOCKED_DOMAIN = 'facebook.com';

describe('background DNR rule application (M2.T7)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const restore of restorers) restore();
    restorers.length = 0;
  });

  it('applies the blocklist rules when a session is running and removes them on pause', async () => {
    const dnr = installDynamicRulesFake();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    await handle.store.getState().startTimer();
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: BLOCKED_DOMAIN },
    });
    await flush();

    const applied = dnr.updates.at(-1);
    expect(applied?.addRules).toHaveLength(1);
    expect(applied?.addRules?.[0]?.condition.urlFilter).toBe(`||${BLOCKED_DOMAIN}^`);
    expect(dnr.liveRules()).toHaveLength(1);

    await handle.store.getState().pauseTimer();
    await flush();

    // Removal is expressed through the ids that were live, not through a
    // hardcoded list: the browser is the record of what is active.
    expect(dnr.updates.at(-1)?.removeRuleIds).toEqual([1]);
    expect(dnr.updates.at(-1)?.addRules).toBeUndefined();
    expect(dnr.liveRules()).toEqual([]);

    handle.dispose();
  });

  it('keeps navigation free outside a focus session', async () => {
    const dnr = installDynamicRulesFake();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: BLOCKED_DOMAIN },
    });
    await flush();

    expect(dnr.liveRules()).toEqual([]);
    // Every update outside a session is a removal-only update.
    for (const update of dnr.updates) {
      expect(update.addRules).toBeUndefined();
    }

    handle.dispose();
  });

  it('reapplies the rules when the session resumes', async () => {
    const dnr = installDynamicRulesFake();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: BLOCKED_DOMAIN },
    });
    await handle.store.getState().startTimer();
    await handle.store.getState().pauseTimer();
    await flush();

    expect(dnr.liveRules()).toEqual([]);

    await handle.store.getState().startTimer();
    await flush();

    expect(dnr.liveRules().map((rule) => rule.condition.urlFilter)).toEqual([
      `||${BLOCKED_DOMAIN}^`,
    ]);

    handle.dispose();
  });

  it('reacts to a blocklist change made while running', async () => {
    const dnr = installDynamicRulesFake();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    await handle.store.getState().startTimer();
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: BLOCKED_DOMAIN },
    });
    await flush();
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'instagram.com' },
    });
    await flush();

    expect(dnr.liveRules().map((rule) => rule.condition.urlFilter)).toEqual([
      `||${BLOCKED_DOMAIN}^`,
      '||instagram.com^',
    ]);

    handle.dispose();
  });

  it('clears the previous session rules on startup when the timer is not running', async () => {
    const dnr = installDynamicRulesFake();
    // Rules left behind by a session that did not survive the restart.
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id: 1,
          action: { type: 'block' },
          condition: { urlFilter: `||${BLOCKED_DOMAIN}^`, resourceTypes: ['sub_frame'] },
        },
      ],
    });
    dnr.updates.length = 0;

    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    expect(dnr.updates.at(-1)?.removeRuleIds).toEqual([1]);
    expect(dnr.liveRules()).toEqual([]);

    handle.dispose();
  });

  it('keeps the rules active when a running session survives a restart', async () => {
    const dnr = installDynamicRulesFake();
    const sessionId = 'session-1';
    await fakeBrowser.storage.local.set({
      [STORE_NAME]: JSON.stringify({
        state: {
          timer: {
            status: 'running',
            remainingSeconds: 1500,
            sessionStartedAt: 0,
            sessionId,
          },
          blocklist: {
            allowlist: [],
            blocklist: [{ domain: { value: BLOCKED_DOMAIN }, tagIds: [] }],
            customTags: [],
          },
        },
        version: 1,
      }),
    });
    const alarmProvider = new FakeAlarmProvider(0);
    await alarmProvider.schedule(timerAlarmName(sessionId), 1500 * 1000);

    const handle = startBackground({ alarmProvider, now: () => 0 });
    await handle.ready;

    expect(handle.store.getState().timer.status).toBe('running');
    expect(dnr.liveRules().map((rule) => rule.condition.urlFilter)).toEqual([
      `||${BLOCKED_DOMAIN}^`,
    ]);

    handle.dispose();
  });

  it('uses the injected applier instead of the browser API', async () => {
    const dnr = installDynamicRulesFake();
    const applied: DnrRule[][] = [];
    const handle = startBackground({
      alarmProvider: new FakeAlarmProvider(0),
      ruleApplier: {
        replaceRules(rules) {
          applied.push([...rules]);
          return Promise.resolve();
        },
      },
    });
    await handle.ready;

    expect(applied).toHaveLength(1);
    expect(dnr.updates).toEqual([]);

    handle.dispose();
  });

  it('exposes the browser applier as the production default (M2.T7)', async () => {
    const dnr = installDynamicRulesFake();
    const applier = createBrowserRuleApplier();

    await applier.replaceRules([
      {
        id: 1,
        action: { type: 'block' },
        condition: { urlFilter: `||${BLOCKED_DOMAIN}^`, resourceTypes: ['sub_frame'] },
      },
    ]);

    expect(dnr.updates.at(-1)?.addRules).toHaveLength(1);
    expect(dnr.liveRules()).toHaveLength(1);

    await applier.replaceRules([]);

    expect(dnr.updates.at(-1)?.removeRuleIds).toEqual([1]);
    expect(dnr.updates.at(-1)?.addRules).toBeUndefined();
    expect(dnr.liveRules()).toEqual([]);
  });

  it('keeps a usable store when the rule update fails', async () => {
    installFailingDynamicRules();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;

    expect(handle.store.getState().timer.status).toBe('idle');

    await handle.store.getState().startTimer();
    await flush();

    expect(errorLog).toHaveBeenCalledWith(
      '[background] DNR rule sync failed',
      expect.any(Error),
    );
    expect(handle.store.getState().timer.status).toBe('running');

    handle.dispose();
  });

  it('does not touch the rules on a state change that leaves them unchanged', async () => {
    const dnr = installDynamicRulesFake();
    const handle = startBackground({ alarmProvider: new FakeAlarmProvider(0) });
    await handle.ready;
    const callsAfterStartup = dnr.updates.length;

    // The blocklist is carried while idle, but the resulting rules stay empty.
    await sendMessage({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: BLOCKED_DOMAIN },
    });
    await flush();
    expect(dnr.updates).toHaveLength(callsAfterStartup);

    // Starting the session is a real change: the rules become non-empty.
    await handle.store.getState().startTimer();
    await flush();
    const callsAfterStart = dnr.updates.length;
    expect(callsAfterStart).toBe(callsAfterStartup + 1);

    // A volatile UI change must not re-evaluate the ruleset.
    handle.store.setState({ ui: { ...handle.store.getState().ui, malusAlertVisible: true } });
    await flush();
    expect(dnr.updates).toHaveLength(callsAfterStart);

    handle.dispose();
  });
});
