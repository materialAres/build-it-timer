import { describe, it, expect } from 'vitest';
import {
  migrateBlocklistState,
  sanitizeBlocklistState,
} from '@/lib/blocking/legacy-blocklist';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (
  value: string,
  tagIds: ReadonlyArray<string> = [],
): BlocklistEntry => ({ domain: { value }, tagIds });

describe('migrateBlocklistState (CR1.T3)', () => {
  it('keeps the legacy blocklist entries that were not allowlisted', () => {
    const migrated = migrateBlocklistState({
      allowlist: [entry('keep.com')],
      blocklist: [entry('facebook.com', ['focus']), entry('keep.com')],
      customTags: [{ id: 'focus', label: 'Focus' }],
    });

    expect(migrated.blocklist).toEqual([entry('facebook.com', ['focus'])]);
    expect(migrated.customTags).toEqual([{ id: 'focus', label: 'Focus' }]);
  });

  it('drops a domain present in both lists (the old allowlist-wins result)', () => {
    const migrated = migrateBlocklistState({
      allowlist: [entry('facebook.com')],
      blocklist: [entry('facebook.com'), entry('x.com')],
      customTags: [],
    });

    expect(migrated.blocklist.map((item) => item.domain.value)).toEqual(['x.com']);
  });

  it('drops an allowlist-only domain instead of promoting it', () => {
    const migrated = migrateBlocklistState({
      allowlist: [entry('keep.com')],
      blocklist: [],
      customTags: [],
    });

    expect(migrated.blocklist).toEqual([]);
  });

  it('preserves already-canonical domains verbatim', () => {
    const migrated = migrateBlocklistState({
      blocklist: [entry('m.facebook.com')],
    });

    expect(migrated.blocklist[0]?.domain.value).toBe('m.facebook.com');
  });

  it('does not introduce duplicate domains (first occurrence wins)', () => {
    const migrated = migrateBlocklistState({
      blocklist: [entry('x.com', ['a']), entry('x.com', ['b'])],
    });

    expect(migrated.blocklist).toEqual([entry('x.com', ['a'])]);
  });

  it('fills a missing tagIds array with an empty list', () => {
    const migrated = migrateBlocklistState({
      blocklist: [{ domain: { value: 'x.com' } }],
    });

    expect(migrated.blocklist).toEqual([entry('x.com')]);
  });

  it('degrades missing or malformed fields to empty arrays without throwing', () => {
    const inputs: ReadonlyArray<unknown> = [
      undefined,
      null,
      'facebook.com',
      42,
      {},
      { allowlist: 'nope', blocklist: 'nope', customTags: 7 },
      {
        blocklist: [
          null,
          {},
          { domain: { value: 1 } },
          { domain: { value: '' } },
          { domain: { value: 'x.com' }, tagIds: 'nope' },
        ],
      },
    ];

    for (const input of inputs) {
      expect(() => migrateBlocklistState(input)).not.toThrow();
      const migrated = migrateBlocklistState(input);
      expect(Array.isArray(migrated.blocklist)).toBe(true);
      expect(Array.isArray(migrated.customTags)).toBe(true);
    }

    expect(migrateBlocklistState(inputs[5])).toEqual({
      blocklist: [],
      customTags: [],
    });
  });

  it('keeps valid entries when the customTags field is malformed', () => {
    const migrated = migrateBlocklistState({
      blocklist: [entry('x.com')],
      customTags: [{ id: 1 }, null, { id: 'focus', label: 'Focus' }],
    });

    expect(migrated.blocklist).toEqual([entry('x.com')]);
    expect(migrated.customTags).toEqual([{ id: 'focus', label: 'Focus' }]);
  });
});

describe('sanitizeBlocklistState (CR1.T3)', () => {
  it('ignores a legacy allowlist instead of applying its precedence', () => {
    const sanitized = sanitizeBlocklistState({
      allowlist: [entry('facebook.com')],
      blocklist: [entry('facebook.com')],
      customTags: [],
    });

    expect(sanitized.blocklist).toEqual([entry('facebook.com')]);
  });

  it('keeps only the two fields of the new shape', () => {
    const sanitized = sanitizeBlocklistState({
      allowlist: [entry('keep.com')],
      blocklist: [entry('x.com')],
      customTags: [{ id: 'focus', label: 'Focus' }],
      stray: true,
    });

    expect(Object.keys(sanitized).sort()).toEqual(['blocklist', 'customTags']);
    expect(sanitized.blocklist).toEqual([entry('x.com')]);
  });
});
