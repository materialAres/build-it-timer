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

/**
 * How the malus escalates with the time spent on a blocked site (M4.T1). Each
 * rule means: from `fromTicks` whole 2s ticks of distraction onwards, every
 * further tick costs `charactersPerTick` characters instead of one. The schedule
 * is data (Open/Closed, §1.1): making the penalty harder or softer is an array
 * edit, never a change to the calculation below. Its first stage weighs the same
 * as the M2.T10 base cadence (one character per tick), so short stays keep the
 * previous behaviour and only longer stays become harsher.
 */
export interface MalusEscalationRule {
  readonly fromTicks: number;
  readonly charactersPerTick: number;
}

export const MALUS_ESCALATION_SCHEDULE: ReadonlyArray<MalusEscalationRule> = [
  { fromTicks: 1, charactersPerTick: 1 },
  { fromTicks: 6, charactersPerTick: 2 },
  { fromTicks: 12, charactersPerTick: 3 },
];

function normalizeTicks(ticksOfDistraction: number): number {
  if (!Number.isFinite(ticksOfDistraction)) return 0;
  return Math.max(0, Math.floor(ticksOfDistraction));
}

function tickCost(tickNumber: number): number {
  let cost = 0;
  for (const rule of MALUS_ESCALATION_SCHEDULE) {
    if (tickNumber >= rule.fromTicks) cost = rule.charactersPerTick;
  }
  return cost;
}

/**
 * Proportional malus (M4.T1): the *additional* characters owed for
 * `ticksOfDistraction` whole 2s ticks spent on a blocked site, on top of the
 * single character removed the moment the user chooses to proceed ("the malus
 * grows as a function of time spent", not just the single event). The value is
 * cumulative and **monotonic non-decreasing** — more time can never yield a
 * smaller malus — because every tick contributes a non-negative cost. Pure and
 * total (non-finite/negative input is normalized to zero, mirroring
 * `applyMalus`), so it is unit-testable in isolation.
 */
export function malusForDistractionTicks(ticksOfDistraction: number): number {
  const ticks = normalizeTicks(ticksOfDistraction);
  let total = 0;
  for (let tick = 1; tick <= ticks; tick += 1) {
    total += tickCost(tick);
  }
  return total;
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
