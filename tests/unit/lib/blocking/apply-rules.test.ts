import { describe, it, expect } from 'vitest';
import {
  createBlockingRulesSync,
  selectActiveRules,
  type BlockingRulesSource,
} from '@/lib/blocking/apply-rules';
import type { BlocklistEntry } from '@/store/store.types';
import { FakeRuleApplier } from '@/tests/helpers/fake-rule-applier';

const entry = (value: string): BlocklistEntry => ({ domain: { value }, tagIds: [] });

function state(
  status: BlockingRulesSource['timer']['status'],
  blocklist: ReadonlyArray<BlocklistEntry> = [],
  allowlist: ReadonlyArray<BlocklistEntry> = [],
): BlockingRulesSource {
  return { timer: { status }, blocklist: { allowlist, blocklist } };
}

describe('selectActiveRules (M2.T7)', () => {
  it('produces no rules while the timer is idle', () => {
    expect(selectActiveRules(state('idle', [entry('facebook.com')]))).toEqual([]);
  });

  it('produces no rules while the timer is paused', () => {
    expect(selectActiveRules(state('paused', [entry('facebook.com')]))).toEqual([]);
  });

  it('produces the blocklist rules while the timer is running', () => {
    const rules = selectActiveRules(state('running', [entry('facebook.com')]));

    expect(rules).toEqual([
      {
        id: 1,
        action: { type: 'block' },
        condition: { urlFilter: '||facebook.com^', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('lets the allowlist win while running (M2.T6 precedence)', () => {
    const rules = selectActiveRules(
      state('running', [entry('facebook.com'), entry('instagram.com')], [entry('facebook.com')]),
    );

    expect(rules.map((rule) => rule.condition.urlFilter)).toEqual(['||instagram.com^']);
  });
});

describe('createBlockingRulesSync (M2.T7)', () => {
  it('applies the rules on the first sync while running', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));

    expect(applier.applied).toHaveLength(1);
    expect(applier.activeRules.map((rule) => rule.condition.urlFilter)).toEqual(['||facebook.com^']);
  });

  it('removes every rule when the session is paused', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));
    await sync.sync(state('paused', [entry('facebook.com')]));

    expect(applier.applied).toHaveLength(2);
    expect(applier.activeRules).toEqual([]);
  });

  it('removes every rule when the session is reset to idle', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));
    await sync.sync(state('idle', [entry('facebook.com')]));

    expect(applier.activeRules).toEqual([]);
  });

  it('reapplies the rules when the timer transitions back to running', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));
    await sync.sync(state('paused', [entry('facebook.com')]));
    await sync.sync(state('running', [entry('facebook.com')]));

    expect(applier.applied).toHaveLength(3);
    expect(applier.activeRules.map((rule) => rule.condition.urlFilter)).toEqual(['||facebook.com^']);
  });

  it('reapplies the rules when the blocklist changes during a running session', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));
    await sync.sync(state('running', [entry('facebook.com'), entry('instagram.com')]));

    expect(applier.activeRules.map((rule) => rule.condition.urlFilter)).toEqual([
      '||facebook.com^',
      '||instagram.com^',
    ]);
  });

  it('skips the browser call when the resulting rules are unchanged', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await sync.sync(state('running', [entry('facebook.com')]));
    // Same rules, new state object: e.g. a timer tick or an unrelated mutation.
    await sync.sync(state('running', [entry('facebook.com')]));

    expect(applier.applied).toHaveLength(1);
  });

  it('writes on the first sync even when there is nothing to block', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    // A cold start must clear whatever the previous session left active.
    await sync.sync(state('idle'));

    expect(applier.applied).toHaveLength(1);
    expect(applier.activeRules).toEqual([]);
  });

  it('serializes concurrent syncs so the last state wins', async () => {
    const applier = new FakeRuleApplier();
    const sync = createBlockingRulesSync(applier);

    await Promise.all([
      sync.sync(state('running', [entry('facebook.com')])),
      sync.sync(state('running', [entry('facebook.com'), entry('instagram.com')])),
    ]);

    expect(applier.activeRules.map((rule) => rule.condition.urlFilter)).toEqual([
      '||facebook.com^',
      '||instagram.com^',
    ]);
  });

  it('retries a failed update on the next sync instead of caching it as applied', async () => {
    let failNext = true;
    const applied: string[][] = [];
    const sync = createBlockingRulesSync({
      replaceRules(rules) {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('updateDynamicRules failed'));
        }
        applied.push(rules.map((rule) => rule.condition.urlFilter ?? ''));
        return Promise.resolve();
      },
    });

    await expect(sync.sync(state('running', [entry('facebook.com')]))).rejects.toThrow(
      'updateDynamicRules failed',
    );
    await sync.sync(state('running', [entry('facebook.com')]));

    expect(applied).toEqual([['||facebook.com^']]);
  });
});
