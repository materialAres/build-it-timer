import { describe, it, expect } from 'vitest';
import {
  computePresetCoverage,
  isPresetApplied,
  togglePreset,
} from '@/lib/blocking/preset-toggle';
import type {
  PresetBlocklistState,
  PresetShape,
  SourcedEntry,
} from '@/lib/blocking/preset-toggle.types';

const preset = (
  id: string,
  name: string,
  domains: ReadonlyArray<string>,
): PresetShape => ({ id, name, domains: domains.map((value) => ({ value })) });

const SOCIAL = preset('social', 'Social', ['x.com', 'facebook.com']);
const VIDEO = preset('video', 'Video', ['youtube.com', 'x.com']);

const entry = (
  domain: string,
  manual: boolean,
  presetIds: ReadonlyArray<string> = [],
): SourcedEntry => ({ domain: { value: domain }, manual, presetIds });

const state = (
  over: Partial<PresetBlocklistState> = {},
): PresetBlocklistState => ({
  blocklist: [],
  appliedPresetIds: [],
  userPresets: [],
  ...over,
});

const domainsOf = (s: PresetBlocklistState): string[] =>
  s.blocklist.map((e) => e.domain.value);

describe('togglePreset — apply (CR4.T2)', () => {
  it('adds the missing domains with the preset as source and marks it applied', () => {
    const next = togglePreset(state(), SOCIAL, true);
    expect(next.blocklist).toEqual([
      entry('x.com', false, ['social']),
      entry('facebook.com', false, ['social']),
    ]);
    expect(next.appliedPresetIds).toEqual(['social']);
  });

  it('adds the source to an existing manual entry without clearing manual', () => {
    const start = state({ blocklist: [entry('x.com', true)] });
    const next = togglePreset(start, SOCIAL, true);
    expect(next.blocklist[0]).toEqual(entry('x.com', true, ['social']));
    expect(domainsOf(next)).toEqual(['x.com', 'facebook.com']);
  });

  it('is idempotent: re-applying returns the same reference', () => {
    const once = togglePreset(state(), SOCIAL, true);
    expect(togglePreset(once, SOCIAL, true)).toBe(once);
  });

  it('re-applying restores a domain removed from the list', () => {
    const once = togglePreset(state(), SOCIAL, true);
    const removed: PresetBlocklistState = {
      ...once,
      blocklist: once.blocklist.filter((e) => e.domain.value !== 'x.com'),
    };
    const again = togglePreset(removed, SOCIAL, true);
    expect(domainsOf(again).sort()).toEqual(['facebook.com', 'x.com']);
    expect(again.appliedPresetIds).toEqual(['social']);
  });

  it('canonicalizes preset domains and skips invalid ones', () => {
    const messy = preset('messy', 'Messy', [
      'https://www.Example.com/path',
      'co.uk',
      'not a url',
    ]);
    const next = togglePreset(state(), messy, true);
    expect(domainsOf(next)).toEqual(['example.com']);
  });

  it('never creates a duplicate entry when two presets overlap', () => {
    const both = togglePreset(togglePreset(state(), SOCIAL, true), VIDEO, true);
    expect(domainsOf(both).filter((d) => d === 'x.com')).toHaveLength(1);
    expect(both.blocklist.find((e) => e.domain.value === 'x.com')).toEqual(
      entry('x.com', false, ['social', 'video']),
    );
  });

  it('does not mutate its input and returns new arrays', () => {
    const start = state({ blocklist: [entry('a.com', true)] });
    const snapshot = JSON.stringify(start);
    const next = togglePreset(start, SOCIAL, true);
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(next.blocklist).not.toBe(start.blocklist);
  });

  it('applies an empty preset as an applied, entry-less preset', () => {
    const empty = preset('user:e', 'Empty', []);
    const next = togglePreset(state(), empty, true);
    expect(next.blocklist).toEqual([]);
    expect(next.appliedPresetIds).toEqual(['user:e']);
  });
});

describe('togglePreset — un-apply (CR4.T2)', () => {
  it('removes entries that have no other source', () => {
    const applied = togglePreset(state(), SOCIAL, true);
    const next = togglePreset(applied, SOCIAL, false);
    expect(next.blocklist).toEqual([]);
    expect(next.appliedPresetIds).toEqual([]);
  });

  it('keeps a manual entry and only drops the preset source', () => {
    const start = state({ blocklist: [entry('x.com', true)] });
    const next = togglePreset(togglePreset(start, SOCIAL, true), SOCIAL, false);
    expect(next.blocklist).toEqual([entry('x.com', true)]);
  });

  it('keeps an entry another applied preset still covers', () => {
    const both = togglePreset(togglePreset(state(), SOCIAL, true), VIDEO, true);
    const next = togglePreset(both, SOCIAL, false);
    expect(next.blocklist).toEqual([
      entry('x.com', false, ['video']),
      entry('youtube.com', false, ['video']),
    ]);
    expect(next.appliedPresetIds).toEqual(['video']);
  });

  it('is idempotent: un-applying a preset that is not applied is a no-op', () => {
    const start = state({ blocklist: [entry('a.com', true)] });
    expect(togglePreset(start, SOCIAL, false)).toBe(start);
  });

  it('cleans the source by id even if the preset definition changed', () => {
    const start = state({
      blocklist: [entry('gone.com', false, ['social'])],
      appliedPresetIds: ['social'],
    });
    const next = togglePreset(start, SOCIAL, false);
    expect(next.blocklist).toEqual([]);
  });
});

describe('isPresetApplied and computePresetCoverage', () => {
  it('reports applied state from the applied set, not from entries', () => {
    expect(isPresetApplied(state(), 'social')).toBe(false);
    const applied = togglePreset(state(), SOCIAL, true);
    expect(isPresetApplied(applied, 'social')).toBe(true);
  });

  it('counts how many of a preset’s domains are covered by the list', () => {
    const applied = togglePreset(state(), SOCIAL, true);
    expect(computePresetCoverage(applied, SOCIAL)).toEqual({
      covered: 2,
      total: 2,
    });
    const partial: PresetBlocklistState = {
      ...applied,
      blocklist: applied.blocklist.filter((e) => e.domain.value !== 'x.com'),
    };
    expect(computePresetCoverage(partial, SOCIAL)).toEqual({
      covered: 1,
      total: 2,
    });
  });

  it('is 0/n for a preset that is not applied', () => {
    expect(computePresetCoverage(state(), SOCIAL)).toEqual({
      covered: 0,
      total: 2,
    });
  });
});
