import { describe, it, expect } from 'vitest';
import { buildDnrRules } from '@/lib/blocking/rules';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, tagIds: [] });

const BLOCK_RESOURCE_TYPES = ['sub_frame'];

describe('buildDnrRules (M2.T6)', () => {
  it('returns no rules for an empty blocklist', () => {
    expect(buildDnrRules([], [])).toEqual([]);
  });

  it('generates a blocking rule for a blocklisted domain', () => {
    const rules = buildDnrRules([entry('facebook.com')], []);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: '||facebook.com^',
        resourceTypes: BLOCK_RESOURCE_TYPES,
      },
    });
  });

  it('anchors the urlFilter to the domain and its subdomains', () => {
    const [rule] = buildDnrRules([entry('example.com')], []);

    expect(rule?.condition.urlFilter).toBe('||example.com^');
  });

  it('emits a single rule for a domain duplicated in the blocklist', () => {
    const rules = buildDnrRules([entry('facebook.com'), entry('facebook.com')], []);

    expect(rules).toHaveLength(1);
  });

  it('does not block a domain present in both the blocklist and the allowlist', () => {
    const rules = buildDnrRules([entry('facebook.com')], [entry('facebook.com')]);

    expect(rules).toEqual([]);
  });

  it('still blocks the other domains when only one is allowlisted', () => {
    const rules = buildDnrRules(
      [entry('facebook.com'), entry('instagram.com')],
      [entry('facebook.com')],
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.condition.urlFilter).toBe('||instagram.com^');
  });

  it('generates no rule for an allowlist-only domain', () => {
    expect(buildDnrRules([], [entry('facebook.com')])).toEqual([]);
  });

  it('assigns unique, sequential ids starting at 1', () => {
    const rules = buildDnrRules(
      [entry('a.com'), entry('b.com'), entry('c.com')],
      [],
    );

    expect(rules.map((rule) => rule.id)).toEqual([1, 2, 3]);
  });

  it('is deterministic: the same input yields a deep-equal output', () => {
    const blocklist = [entry('a.com'), entry('b.com')];
    const allowlist = [entry('b.com')];

    expect(buildDnrRules(blocklist, allowlist)).toEqual(buildDnrRules(blocklist, allowlist));
  });

  it('does not mutate its inputs', () => {
    const blocklist = [entry('a.com')];
    const allowlist = [entry('a.com')];
    const blocklistBefore = structuredClone(blocklist);
    const allowlistBefore = structuredClone(allowlist);

    buildDnrRules(blocklist, allowlist);

    expect(blocklist).toEqual(blocklistBefore);
    expect(allowlist).toEqual(allowlistBefore);
  });
});
