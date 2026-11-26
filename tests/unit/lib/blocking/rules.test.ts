import { describe, it, expect } from 'vitest';
import { buildDnrRules } from '@/lib/blocking/rules';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (domain: string): BlocklistEntry => ({ domain: { value: domain }, manual: true, presetIds: [] });

const BLOCK_RESOURCE_TYPES = ['sub_frame'];

describe('buildDnrRules (M2.T6, CR1.T4)', () => {
  it('returns no rules for an empty blocklist', () => {
    expect(buildDnrRules([])).toEqual([]);
  });

  it('generates a blocking rule for a blocklisted domain', () => {
    const rules = buildDnrRules([entry('facebook.com')]);

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
    const [rule] = buildDnrRules([entry('example.com')]);

    expect(rule?.condition.urlFilter).toBe('||example.com^');
  });

  it('emits a single rule for a domain duplicated in the blocklist', () => {
    const rules = buildDnrRules([entry('facebook.com'), entry('facebook.com')]);

    expect(rules).toHaveLength(1);
  });

  it('only needs the blocklist: there is no second list to cancel a rule', () => {
    const rules = buildDnrRules([entry('facebook.com'), entry('instagram.com')]);

    expect(rules.map((rule) => rule.condition.urlFilter)).toEqual([
      '||facebook.com^',
      '||instagram.com^',
    ]);
  });

  it('assigns unique, sequential ids starting at 1', () => {
    const rules = buildDnrRules([entry('a.com'), entry('b.com'), entry('c.com')]);

    expect(rules.map((rule) => rule.id)).toEqual([1, 2, 3]);
  });

  it('is deterministic: the same input yields a deep-equal output', () => {
    const blocklist = [entry('a.com'), entry('b.com')];

    expect(buildDnrRules(blocklist)).toEqual(buildDnrRules(blocklist));
  });

  it('does not mutate its input', () => {
    const blocklist = [entry('a.com')];
    const before = structuredClone(blocklist);

    buildDnrRules(blocklist);

    expect(blocklist).toEqual(before);
  });

  describe('defensive normalization on consumption (M2.T21)', () => {
    it('canonicalizes a non-canonical stored entry before building the rule', () => {
      const rules = buildDnrRules([entry('https://m.facebook.com/x')]);

      expect(rules).toHaveLength(1);
      expect(rules[0]?.condition.urlFilter).toBe('||facebook.com^');
    });

    it('collapses two variants of the same registrable domain onto one rule', () => {
      const rules = buildDnrRules([
        entry('https://m.facebook.com/x'),
        entry('www.facebook.com'),
      ]);

      expect(rules).toHaveLength(1);
      expect(rules[0]?.condition.urlFilter).toBe('||facebook.com^');
    });

    it('drops an entry that is not a valid registrable domain', () => {
      expect(buildDnrRules([entry('co.uk')])).toEqual([]);
      expect(buildDnrRules([entry('github.io')])).toEqual([]);
      expect(buildDnrRules([entry('not a url')])).toEqual([]);
    });
  });

  describe('urlFilter safety (M6.T3)', () => {
    const SAFE_FILTER = /^\|\|[a-z0-9.-]+\^$/;

    it.each([
      '*.facebook.com',
      'face*book.com',
      '*',
      '||facebook.com^',
      '||facebook.com',
      'facebook.com^',
      'facebook.com|',
      '|facebook.com',
      'facebook.com^*',
      'https://facebook.com/*',
      'facebook.com/^x',
    ])('never turns %j into a wildcard or an altered anchor', (raw) => {
      for (const rule of buildDnrRules([entry(raw)])) {
        expect(rule.condition.urlFilter).toMatch(SAFE_FILTER);
      }
    });

    it.each(['*', '||facebook.com^', 'face*book.com', 'facebook.com|', '^'])(
      'drops the unrecoverable entry %j instead of emitting a rule',
      (raw) => {
        expect(buildDnrRules([entry(raw)])).toEqual([]);
      },
    );

    it('keeps the rule of a well-formed entry next to a hostile one', () => {
      const rules = buildDnrRules([entry('*'), entry('facebook.com'), entry('||x.com^')]);

      expect(rules.map((rule) => rule.condition.urlFilter)).toEqual(['||facebook.com^']);
    });

    it('only ever emits [a-z0-9.-] between the anchor and the separator', () => {
      const raws = ['MÜNCHEN.de', 'раypal.com', 'https://user:pw@facebook.com', 'a.b.c.example.com'];

      for (const rule of buildDnrRules(raws.map(entry))) {
        expect(rule.condition.urlFilter).toMatch(SAFE_FILTER);
      }
    });
  });
});
