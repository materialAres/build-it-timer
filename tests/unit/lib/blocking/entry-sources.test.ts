import { describe, it, expect } from 'vitest';
import { computeEntrySourceLabels } from '@/lib/blocking/entry-sources';
import type { Preset, Tag } from '@/store/store.types';

const preset = (id: string, name: string): Preset => ({
  id,
  name,
  domains: [],
  tag: { id: `preset:${id}`, label: name },
});

const PRESETS: ReadonlyArray<Preset> = [
  preset('social', 'Social'),
  preset('video', 'Video'),
];
const CUSTOM_TAGS: ReadonlyArray<Tag> = [{ id: 'work', label: 'Work' }];

describe('computeEntrySourceLabels (UI.T1)', () => {
  it('returns no labels for a manually added entry', () => {
    expect(computeEntrySourceLabels([], PRESETS, CUSTOM_TAGS)).toEqual([]);
  });

  it('maps a preset tag id to the preset name', () => {
    expect(
      computeEntrySourceLabels(['preset:social'], PRESETS, CUSTOM_TAGS),
    ).toEqual(['Social']);
  });

  it('maps a custom tag id to its label', () => {
    expect(computeEntrySourceLabels(['work'], PRESETS, CUSTOM_TAGS)).toEqual([
      'Work',
    ]);
  });

  it('keeps the entry order and resolves several sources', () => {
    expect(
      computeEntrySourceLabels(
        ['work', 'preset:video', 'preset:social'],
        PRESETS,
        CUSTOM_TAGS,
      ),
    ).toEqual(['Work', 'Video', 'Social']);
  });

  it('skips ids that no longer resolve (e.g. a deleted tag)', () => {
    expect(
      computeEntrySourceLabels(['gone', 'preset:video'], PRESETS, CUSTOM_TAGS),
    ).toEqual(['Video']);
  });

  it('never repeats a label', () => {
    expect(
      computeEntrySourceLabels(
        ['preset:social', 'preset:social'],
        PRESETS,
        CUSTOM_TAGS,
      ),
    ).toEqual(['Social']);
  });
});
