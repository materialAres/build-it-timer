import type { Preset } from '@/store/store.types';

/**
 * Ready-made blocklist presets (M2.T5).
 *
 * Data only — no application logic (Open/Closed principle, §1.1): adding a new
 * preset means adding an element to this array, never touching the code that
 * applies presets (M3.T1) or expands them (M2.T5's consumer in the background).
 *
 * Every domain is stored in canonical registrable form (`eTLD+1`, subdomains
 * removed — the M1.T2 design decision), so a preset can be applied without a
 * second normalization pass and can never introduce a `www.`/`m.` duplicate.
 */
export const PRESETS: ReadonlyArray<Preset> = [
  {
    id: 'social',
    name: 'Social',
    domains: [
      { value: 'instagram.com' },
      { value: 'facebook.com' },
      { value: 'x.com' },
      { value: 'tiktok.com' },
    ],
  },
  {
    id: 'video',
    name: 'Video',
    domains: [
      { value: 'youtube.com' },
      { value: 'netflix.com' },
      { value: 'twitch.tv' },
      { value: 'vimeo.com' },
    ],
  },
  {
    id: 'news',
    name: 'News',
    domains: [
      { value: 'reddit.com' },
      { value: 'ycombinator.com' },
      { value: 'cnn.com' },
    ],
  },
];

/** Look up a preset by its id; `undefined` when no preset matches. */
export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
