import type { CityGrid, CityLayers, CityCell } from '@/components/city/city.types';

/**
 * The malus cadence: the same 2s tick used for construction (M2.T15), applied
 * in reverse. One tick of distraction removes exactly one character.
 */
export const MALUS_TICK_MS = 2_000;

/**
 * The order in which the malus consumes cells that sit on the same row. The
 * middleground carries the main skyscrapers (M2.T12), so its characters are the
 * most prominent and disappear first; within a layer the scan is left to right.
 */
const MALUS_LAYER_ORDER = ['middleground', 'background', 'foreground'] as const;

const EMPTY_CELL: CityCell = { char: null };

function normalizeTicks(ticksOfDistraction: number): number {
  if (!Number.isFinite(ticksOfDistraction)) return 0;
  return Math.max(0, Math.floor(ticksOfDistraction));
}

function clearCell(
  layers: CityLayers,
  layer: (typeof MALUS_LAYER_ORDER)[number],
  row: number,
  col: number,
): CityLayers {
  const clear = (grid: CityGrid): CityGrid => ({
    ...grid,
    cells: grid.cells.map((line, r) =>
      r !== row ? line : line.map((cell, c) => (c !== col ? cell : EMPTY_CELL)),
    ),
  });

  switch (layer) {
    case 'middleground':
      return { ...layers, middleground: clear(layers.middleground) };
    case 'background':
      return { ...layers, background: clear(layers.background) };
    case 'foreground':
      return { ...layers, foreground: clear(layers.foreground) };
  }
}

/**
 * Remove the single, most recently built character still standing: the topmost
 * occupied cell, scanning rows top to bottom. Growth builds upwards, so the
 * inverse crumbles a building from its top down (roadmap M2.T10).
 *
 * Returns the *same* reference when no character is left, so "the city is
 * already empty" is an explicit no-op rather than an error or an undefined
 * intermediate state.
 */
function removeOneCharacter(layers: CityLayers): CityLayers {
  const height = Math.max(
    layers.background.height,
    layers.middleground.height,
    layers.foreground.height,
  );

  for (let row = 0; row < height; row += 1) {
    for (const layer of MALUS_LAYER_ORDER) {
      const grid = layers[layer];
      for (let col = 0; col < grid.width; col += 1) {
        const cell = grid.cells[row]?.[col];
        if (cell !== undefined && cell.char !== null) {
          return clearCell(layers, layer, row, col);
        }
      }
    }
  }

  return layers;
}

/**
 * Progressive malus (M2.T10): the inverse of the growth engine, removing one
 * character for each 2s tick spent on a blocked site. When there is nothing left
 * to destroy the city simply stops shrinking — the function is total and pure
 * (no browser, no clock, no randomness), so it is unit-testable in isolation.
 *
 * The function owns the *character deletion* only. Which building belongs to
 * which domain, and how distraction time is accumulated (multi-tab detection),
 * are kept outside: see `lib/timer/tab-distraction-tracker.ts`.
 */
export function applyMalus(city: CityLayers, ticksOfDistraction: number): CityLayers {
  const ticks = normalizeTicks(ticksOfDistraction);
  let layers = city;

  for (let i = 0; i < ticks; i += 1) {
    const next = removeOneCharacter(layers);
    if (next === layers) break; // city already empty: safe no-op
    layers = next;
  }

  return layers;
}
