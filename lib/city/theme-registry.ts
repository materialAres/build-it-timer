import type { Theme } from '@/components/city/city.types';
import { DEFAULT_BUILDING_PALETTE } from './palette';
import { hashString } from '@/utils/hash';

/**
 * The theme/biome a city falls back to when the session cannot be resolved to a
 * registry entry (roadmap M2.T13b). It is a real member of `THEME_REGISTRY`, so
 * the fallback is always renderable.
 */
export const DEFAULT_THEME_ID = 'default';

/**
 * Available color themes/biomes, one per focus session (M2.T13b).
 *
 * Data only — no selection logic (Open/Closed principle, §1.1): adding a biome
 * means adding an element to this array, never touching `selectThemeId` or the
 * components that consume a `Theme.palette`. Every palette is a set of hex
 * colors the deterministic domain hash (`getBuildingColor`, M2.T13) draws from,
 * and `backgroundColor` is the backdrop the city is rendered on.
 */
export const THEME_REGISTRY: ReadonlyArray<Theme> = [
  {
    id: DEFAULT_THEME_ID,
    name: 'Neon Metropolis',
    palette: DEFAULT_BUILDING_PALETTE,
    backgroundColor: '#0b0f14',
  },
  {
    id: 'sunset',
    name: 'Sunset Strip',
    palette: ['#ff6b6b', '#ffa94d', '#ffd43b', '#f783ac'],
    backgroundColor: '#1a0f12',
  },
  {
    id: 'arctic',
    name: 'Arctic Dawn',
    palette: ['#4dabf7', '#74c0fc', '#99e9f2', '#dee2e6'],
    backgroundColor: '#0a1620',
  },
  {
    id: 'phosphor',
    name: 'CRT Phosphor',
    palette: ['#51cf66', '#40c057', '#8ce99a', '#b2f2bb'],
    backgroundColor: '#000000',
  },
];

/** Look up a theme by its id; `undefined` when no theme matches. */
export function getThemeById(id: string): Theme | undefined {
  return THEME_REGISTRY.find((theme) => theme.id === id);
}

/**
 * Deterministically pick the theme id for a focus session (M2.T13b): the same
 * `sessionId` always maps to the same biome, so the theme survives a service
 * worker restart and matches the city that session built, while different
 * sessions get different biomes. Pure: no `Date.now()`/`Math.random()` (§1.4).
 *
 * The mapping is a hash of the session id over the registry, in the same spirit
 * as the domain → color hash (M2.T13), so the distribution across biomes is
 * even. Total: an unknown/empty session id (or an empty registry) degrades to
 * `DEFAULT_THEME_ID` instead of throwing at this untrusted boundary (§1.4).
 */
export function selectThemeId(sessionId: string): string {
  if (THEME_REGISTRY.length === 0) return DEFAULT_THEME_ID;

  const index = hashString(sessionId) % THEME_REGISTRY.length;
  return THEME_REGISTRY[index]?.id ?? DEFAULT_THEME_ID;
}
