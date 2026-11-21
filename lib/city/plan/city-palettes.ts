import type { CityPalette } from './city-plan.types';

/**
 * Session palettes (data, Open/Closed): adding one is adding an element here.
 * Each has at least six distinct neon colors, bright enough to stay readable on
 * the black floor after any hue shift of ±`MAX_HUE_SHIFT` degrees (checked in
 * `assign-colors.test.ts`), plus the accents of windows, lamps and beacons.
 * These are the city's contents, not interface tokens: they sit outside the
 * One Beam Rule (DESIGN.md).
 */
export const CITY_PALETTES: ReadonlyArray<CityPalette> = [
  {
    id: 'neon-city',
    name: 'Neon City',
    colors: ['#00e5ff', '#ff2bd6', '#ffb000', '#9dff3a', '#a56bff', '#ff6a5c'],
    window: '#ffe9a8',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
  {
    id: 'sunset',
    name: 'Sunset Strip',
    colors: ['#ff5e5e', '#ff9a3d', '#ffd23f', '#ff6fa8', '#ffb38a', '#ff7a45'],
    window: '#ffe9a8',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
  {
    id: 'arctic',
    name: 'Arctic Dawn',
    colors: ['#6fe6ff', '#a8f0ff', '#5ab8ff', '#c9f7ff', '#7ff5d8', '#8fb6ff'],
    window: '#d6f6ff',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
  {
    id: 'toxic',
    name: 'Toxic Grid',
    colors: ['#7dff3a', '#d4ff3a', '#3affa8', '#f2ff6b', '#a8ff7a', '#3affe0'],
    window: '#f2ffc4',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    colors: ['#ff3ea5', '#b86bff', '#ff8a3d', '#35e0ff', '#ffe14d', '#ff6bd6'],
    window: '#ffe9a8',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
  {
    id: 'amber-terminal',
    name: 'Amber Terminal',
    colors: ['#ffb000', '#ffc94d', '#ff9a1f', '#ffe08a', '#ffd166', '#f5a623'],
    window: '#fff0c2',
    lamp: '#ffd479',
    beacon: '#ff6b6b',
  },
];
