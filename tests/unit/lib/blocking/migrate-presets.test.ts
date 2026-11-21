import { describe, it, expect } from 'vitest';
import {
  migratePersistedBlocklist,
  migrateToPresets,
} from '@/lib/blocking/migrate-presets';
import type { EffectiveBlocklist } from '@/lib/blocking/legacy-blocklist';

const v2Entry = (domain: string, tagIds: string[] = []) => ({
  domain: { value: domain },
  tagIds,
});

const FOCUS = { id: 'focus', label: 'Focus' };

describe('migrateToPresets (CR4.T3)', () => {
  it('turns an untagged entry into a manual one', () => {
    const legacy: EffectiveBlocklist = {
      blocklist: [v2Entry('x.com')],
      customTags: [],
    };

    expect(migrateToPresets(legacy)).toEqual({
      blocklist: [{ domain: { value: 'x.com' }, manual: true, presetIds: [] }],
      appliedPresetIds: [],
      userPresets: [],
    });
  });

  it('keeps a built-in preset tag as that preset and marks it applied', () => {
    const next = migrateToPresets({
      blocklist: [v2Entry('facebook.com', ['social'])],
      customTags: [],
    });

    expect(next.blocklist[0]).toEqual({
      domain: { value: 'facebook.com' },
      manual: false,
      presetIds: ['social'],
    });
    expect(next.appliedPresetIds).toEqual(['social']);
    expect(next.userPresets).toEqual([]);
  });

  it('turns a custom tag into an applied user preset holding its entries', () => {
    const next = migrateToPresets({
      blocklist: [v2Entry('a.com', ['focus']), v2Entry('b.com'), v2Entry('c.com', ['focus'])],
      customTags: [FOCUS],
    });

    expect(next.userPresets).toEqual([
      { id: 'user:focus', name: 'Focus', domains: [{ value: 'a.com' }, { value: 'c.com' }] },
    ]);
    expect(next.appliedPresetIds).toEqual(['user:focus']);
    expect(next.blocklist.map((e) => [e.domain.value, e.manual, e.presetIds])).toEqual([
      ['a.com', false, ['user:focus']],
      ['b.com', true, []],
      ['c.com', false, ['user:focus']],
    ]);
  });

  it('combines a built-in tag and a custom tag on one entry, without repeats', () => {
    const next = migrateToPresets({
      blocklist: [v2Entry('x.com', ['social', 'focus', 'social'])],
      customTags: [FOCUS],
    });

    expect(next.blocklist[0]?.presetIds).toEqual(['social', 'user:focus']);
    expect(next.appliedPresetIds).toEqual(['social', 'user:focus']);
  });

  it('drops an unknown tag id and makes an otherwise untagged entry manual', () => {
    const next = migrateToPresets({
      blocklist: [v2Entry('x.com', ['deleted-tag'])],
      customTags: [],
    });

    expect(next.blocklist[0]).toEqual({
      domain: { value: 'x.com' },
      manual: true,
      presetIds: [],
    });
  });

  it('keeps a tag with no entries as an empty, un-applied preset', () => {
    const next = migrateToPresets({ blocklist: [], customTags: [FOCUS] });

    expect(next.userPresets).toEqual([{ id: 'user:focus', name: 'Focus', domains: [] }]);
    expect(next.appliedPresetIds).toEqual([]);
  });

  it('does not mutate its input', () => {
    const legacy: EffectiveBlocklist = {
      blocklist: [v2Entry('x.com', ['focus'])],
      customTags: [FOCUS],
    };
    const snapshot = JSON.stringify(legacy);

    migrateToPresets(legacy);

    expect(JSON.stringify(legacy)).toBe(snapshot);
  });
});

describe('migratePersistedBlocklist (CR4.T3)', () => {
  it('migrates a version-1 payload: the allowlist wins, then tags become presets', () => {
    const next = migratePersistedBlocklist(
      {
        allowlist: [v2Entry('facebook.com')],
        blocklist: [v2Entry('facebook.com', ['focus']), v2Entry('x.com', ['focus'])],
        customTags: [FOCUS],
      },
      1,
    );

    expect(next.blocklist.map((e) => e.domain.value)).toEqual(['x.com']);
    expect(next.userPresets).toEqual([
      { id: 'user:focus', name: 'Focus', domains: [{ value: 'x.com' }] },
    ]);
  });

  it('migrates a version-2 payload', () => {
    const next = migratePersistedBlocklist(
      { blocklist: [v2Entry('x.com', ['focus'])], customTags: [FOCUS] },
      2,
    );

    expect(next.appliedPresetIds).toEqual(['user:focus']);
  });

  it('only sanitizes a version-3 payload', () => {
    const v3 = {
      blocklist: [{ domain: { value: 'x.com' }, manual: true, presetIds: [] }],
      appliedPresetIds: [],
      userPresets: [],
    };

    expect(migratePersistedBlocklist(v3, 3)).toEqual(v3);
  });

  it.each([undefined, null, 'nope', 7])('degrades %j to an empty blocklist at any version', (raw) => {
    for (const version of [1, 2, 3]) {
      expect(migratePersistedBlocklist(raw, version)).toEqual({
        blocklist: [],
        appliedPresetIds: [],
        userPresets: [],
      });
    }
  });
});
