import { describe, it, expect } from 'vitest';
import { computeEntrySourceLabels } from '@/lib/blocking/entry-sources';
import type { Preset } from '@/store/store.types';

const preset = (id: string, name: string): Preset => ({
  id,
  name,
  domains: [],
});

const PRESETS: ReadonlyArray<Preset> = [
  preset('social', 'Social'),
  preset('video', 'Video'),
  preset('user:work', 'Work'),
];

describe('computeEntrySourceLabels (UI.T1, CR4.T3)', () => {
  it('returns no labels for a manual-only entry', () => {
    expect(computeEntrySourceLabels([], PRESETS)).toEqual([]);
  });

  it('maps a built-in preset id to the preset name', () => {
    expect(computeEntrySourceLabels(['social'], PRESETS)).toEqual(['Social']);
  });

  it('maps a saved preset id to its name', () => {
    expect(computeEntrySourceLabels(['user:work'], PRESETS)).toEqual(['Work']);
  });

  it('keeps the entry order and resolves several sources', () => {
    expect(
      computeEntrySourceLabels(['user:work', 'video', 'social'], PRESETS),
    ).toEqual(['Work', 'Video', 'Social']);
  });

  it('skips ids that no longer resolve (e.g. a deleted preset)', () => {
    expect(computeEntrySourceLabels(['gone', 'video'], PRESETS)).toEqual([
      'Video',
    ]);
  });

  it('never repeats a label', () => {
    expect(computeEntrySourceLabels(['social', 'social'], PRESETS)).toEqual([
      'Social',
    ]);
  });
});
