import type { BuildingModule, BuildingModuleCategory } from '@/components/city/city.types';

/**
 * The width, in characters, of one module "unit" on the city grid. Every module
 * width is an exact multiple of it, so two modules can always be aligned on the
 * same character grid when one is stacked on top of the other.
 */
export const TILE_BASE_WIDTH = 8;

/**
 * Library of composable ASCII modules (M2.T11b).
 *
 * Data only — no selection logic (Open/Closed principle, §1.1): the building
 * composer (`lib/city/building-composer.ts`, M2.T11c) decides which module to
 * use, this file only declares what is available. Adding a variant means adding
 * an element to `TILE_LIBRARY`, never touching the composition logic.
 *
 * Every module declares its own `widthChars` and every row is exactly that
 * wide, so stacking a base, a set of floors and a top never misaligns. The
 * categories match `BuildingModuleCategory` (`base` | `floor` | `top`).
 */
export const TILE_LIBRARY: ReadonlyArray<BuildingModule> = [
  // --- Bases / foundations -------------------------------------------------
  // Both rows draw ink high in their cell. The previous top row was a bare
  // `________`, which renders on the baseline only: the upper ~90% of that cell
  // stayed empty and stacked with the pavement's identical row into a visible
  // blank band between a house and its base (see I004).
  {
    id: 'base-office',
    category: 'base',
    widthChars: 8,
    rows: ['|[====]|', '|======|'],
  },
  {
    id: 'base-residential',
    category: 'base',
    widthChars: 8,
    rows: ['|======|', '|[=][=]|'],
  },
  {
    id: 'base-glass',
    category: 'base',
    widthChars: 8,
    rows: ['|======|', '|__||__|'],
  },
  {
    id: 'base-door',
    category: 'base',
    widthChars: 8,
    rows: ['|[ || ]|', '|^|==|^|'],
  },
  {
    id: 'base-market',
    category: 'base',
    widthChars: 8,
    rows: ['|Market|', '|[=][=]|'],
  },
  {
    id: 'base-bistro',
    category: 'base',
    widthChars: 8,
    rows: ['|Bistro|', '|[ ][ ]|'],
  },
  {
    id: 'base-studio',
    category: 'base',
    widthChars: 8,
    rows: ['|Studio|', '|[O][O]|'],
  },
  {
    id: 'base-saloon',
    category: 'base',
    widthChars: 8,
    rows: ['|Saloon|', '|[_][_]|'],
  },

  // --- Floor sections -------------------------------------------------------
  {
    id: 'floor-office',
    category: 'floor',
    widthChars: 8,
    rows: ['|[ ][ ]|'],
  },
  {
    id: 'floor-residential',
    category: 'floor',
    widthChars: 8,
    rows: ['|[#][#]|'],
  },
  {
    id: 'floor-residential-variant',
    category: 'floor',
    widthChars: 8,
    rows: ['|[#][ ]|'],
  },
  {
    id: 'floor-residential-variant-2',
    category: 'floor',
    widthChars: 8,
    rows: ['|[ ][#]|'],
  },
  {
    id: 'floor-residential-variant-3',
    category: 'floor',
    widthChars: 8,
    rows: ['|[ ][*]|'],
  },
    {
    id: 'floor-residential-variant-4',
    category: 'floor',
    widthChars: 8,
    rows: ['|[*][ ]|'],
  },
    {
    id: 'floor-residential-variant-5',
    category: 'floor',
    widthChars: 8,
    rows: ['|[*][*]|'],
  },
  {
    id: 'floor-glass-front',
    category: 'floor',
    widthChars: 8,
    rows: ['|/\\/\\/\\|'],
  },

  // --- Top elements ---------------------------------------------------------
  {
    id: 'top-antenna',
    category: 'top',
    widthChars: 8,
    rows: ['___/\\___'],
  },
  {
    id: 'top-antenna-variant',
    category: 'top',
    widthChars: 8,
    rows: ['______/\\'],
  },
  {
    id: 'top-dome',
    category: 'top',
    widthChars: 8,
    rows: ['  .--.  '],
  },
  {
    id: 'top-dome-large',
    category: 'top',
    widthChars: 8,
    rows: ['.------.'],
  },
  {
    id: 'top-dome-antenna',
    category: 'top',
    widthChars: 8,
    rows: ['.--/\\--.'],
  },
  {
    id: 'top-roof',
    category: 'top',
    widthChars: 8,
    rows: ['/------\\'],
  },
];

/**
 * A width is compatible with the character grid when it is a positive, exact
 * multiple of `TILE_BASE_WIDTH`. The composer relies on this to guarantee that
 * any two modules line up when they are stacked vertically.
 */
export function isWidthCompatible(
  widthChars: number,
  baseWidth: number = TILE_BASE_WIDTH,
): boolean {
  if (!Number.isInteger(widthChars) || widthChars <= 0) return false;
  if (!Number.isInteger(baseWidth) || baseWidth <= 0) return false;
  return widthChars % baseWidth === 0;
}

/** All modules of a category, in declaration order. */
export function getModulesByCategory(
  category: BuildingModuleCategory,
): ReadonlyArray<BuildingModule> {
  return TILE_LIBRARY.filter((module) => module.category === category);
}

/** Look up a module by its id; `undefined` when no module matches. */
export function getModuleById(id: string): BuildingModule | undefined {
  return TILE_LIBRARY.find((module) => module.id === id);
}
