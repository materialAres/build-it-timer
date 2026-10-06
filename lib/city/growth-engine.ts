import type {
  CityCell,
  CityGrid,
  CityLayers,
  CityLayerName,
  ComposedBuilding,
  SeededRandom,
} from '@/components/city/city.types';
import { composeBuilding } from './building-composer';

/**
 * Growth cadence: one character of city per 2 seconds of undistracted focus
 * (roadmap M2.T12). This is the fine-grained "character-insertion tick", kept
 * distinct from the 60s `browser.alarms` persistence clock (M1.T5): it is
 * recalculated from the elapsed focus time, never driven by an alarm.
 */
export const GROWTH_TICK_MS = 2_000;

/**
 * The order in which growth lands on the three parallax layers. Background
 * carries the small buildings/stars, the middleground the main skyscrapers and
 * the foreground the street/trees; rotating through the order spreads every
 * batch of three characters one per layer instead of filling one completely
 * before touching the next (roadmap M2.T12).
 */
const GROWTH_LAYER_ORDER: ReadonlyArray<CityLayerName> = [
  'background',
  'middleground',
  'foreground',
];

/**
 * Glyphs used before the building composer unlocks its first module: the first
 * unlock threshold is minute 5, but the city must already show something from
 * the very first tick. They double as the defensive fallback when a composed
 * building carries no usable character.
 */
const FALLBACK_GLYPHS: Readonly<Record<CityLayerName, string>> = {
  background: '.',
  middleground: '#',
  foreground: '|',
};

/**
 * Number of characters a positive elapsed time is worth: `floor(elapsed / 2s)`.
 * Non-finite and negative input defensively yields 0, mirroring `applyMalus`
 * (M2.T10) so an untrusted delta can never turn into an unbounded loop (§1.4).
 */
function ticksFor(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  return Math.max(0, Math.floor(elapsedMs / GROWTH_TICK_MS));
}

/**
 * Minimal deterministic PRNG (mulberry32). The engine derives it from the seed
 * it was built with, so the composer stays free of `Math.random()` (§1.4) while
 * the same session always regenerates the same city.
 */
function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

function countOccupied(grid: CityGrid): number {
  let total = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.char !== null) total += 1;
    }
  }
  return total;
}

/**
 * The next free cell of a layer, in growth order: columns left to right, and
 * inside each column rows bottom to top. Filling a column upwards is what makes
 * the ASCII read as buildings rising from the ground, and it is the inverse of
 * the malus (which removes the topmost published cell first, M2.T10).
 */
function nextFreeSlot(grid: CityGrid): { row: number; col: number } | null {
  for (let col = 0; col < grid.width; col += 1) {
    for (let row = grid.height - 1; row >= 0; row -= 1) {
      const cell = grid.cells[row]?.[col];
      if (cell !== undefined && cell.char === null) return { row, col };
    }
  }
  return null;
}

function setCell(
  grid: CityGrid,
  row: number,
  col: number,
  cell: CityCell,
): CityGrid {
  return {
    ...grid,
    cells: grid.cells.map((line, r) =>
      r !== row ? line : line.map((current, c) => (c !== col ? current : cell)),
    ),
  };
}

function placeCell(
  layers: CityLayers,
  layer: CityLayerName,
  row: number,
  col: number,
  cell: CityCell,
): CityLayers {
  switch (layer) {
    case 'background':
      return { ...layers, background: setCell(layers.background, row, col, cell) };
    case 'middleground':
      return { ...layers, middleground: setCell(layers.middleground, row, col, cell) };
    case 'foreground':
      return { ...layers, foreground: setCell(layers.foreground, row, col, cell) };
  }
}

/**
 * Pick the layer for the character at global tick `tick`: the rotating
 * background → middleground → foreground order, skipping any layer that is
 * already full. Returns `null` when every layer is full (the visual cap).
 */
function pickLayer(layers: CityLayers, tick: number): CityLayerName | null {
  const start = tick % GROWTH_LAYER_ORDER.length;
  for (let offset = 0; offset < GROWTH_LAYER_ORDER.length; offset += 1) {
    const candidate =
      GROWTH_LAYER_ORDER[(start + offset) % GROWTH_LAYER_ORDER.length];
    if (candidate !== undefined && nextFreeSlot(layers[candidate]) !== null) {
      return candidate;
    }
  }
  return null;
}

/**
 * The glyph for one character, taken from the building the composer has earned
 * after `minutesFocused` of focus. Before the first unlock threshold the
 * composer returns an unbuilt building, so the layer's fallback glyph is used.
 * The character is picked by walking the composed rows; it is deterministic for
 * a given building and tick, and the composer itself is re-seeded from the
 * engine's stable seed so already-unlocked modules keep their variant.
 */
function glyphFor(
  tick: number,
  layer: CityLayerName,
  seed: number,
): string {
  const minutesFocused = (tick * GROWTH_TICK_MS) / 60_000;
  const building: ComposedBuilding = composeBuilding(
    minutesFocused,
    createSeededRandom(seed),
  );
  const characters = building.rows.join('').replace(/\s+/g, '');
  if (characters.length === 0) return FALLBACK_GLYPHS[layer];
  return characters.charAt(tick % characters.length) || FALLBACK_GLYPHS[layer];
}

/**
 * Grow the three city layers by the undistracted focus time elapsed since the
 * last call (roadmap M2.T12). Every 2 seconds inserts exactly **one** character
 * — never a whole module at once — distributing the characters across the
 * background, middleground and foreground layers.
 *
 * Pure and deterministic: the same `(layers, elapsedMs, seed)` always yields a
 * deep-equal result, with no internal `Date.now()`/`Math.random()` (principles
 * D, §1.4). When all three layers are full the function stops inserting and
 * returns the *same* `CityLayers` reference, so the visual cap is an explicit
 * no-op rather than an error or an out-of-bounds write; session progress (score,
 * population) is computed elsewhere from elapsed time and keeps advancing.
 */
export function growCity(
  layers: CityLayers,
  elapsedMs: number,
  seed = 0,
): CityLayers {
  const ticks = ticksFor(elapsedMs);
  if (ticks === 0) return layers;

  let current = layers;
  // The global tick index is what drives the rotation and the glyph choice; it
  // starts from the number of characters already standing.
  const placedBefore = countOccupied(layers.background) +
    countOccupied(layers.middleground) +
    countOccupied(layers.foreground);

  for (let index = 0; index < ticks; index += 1) {
    const tick = placedBefore + index;
    const layer = pickLayer(current, tick);
    if (layer === null) break; // all layers full: the visual cap

    const slot = nextFreeSlot(current[layer]);
    if (slot === null) break; // unreachable once `pickLayer` checked it

    const glyph = glyphFor(tick, layer, seed);
    current = placeCell(current, layer, slot.row, slot.col, { char: glyph });
  }

  return current;
}

/** Collaborators/parameters the growth engine is built with. */
export interface GrowthEngineOptions {
  /** Seed derived from the session id (wiring is M2.T15). */
  readonly seed: number;
}

/**
 * Adapter to the `CityGrowthEngine` port consumed by `citySlice.growCity`
 * (M2.T11). Binding the seed here keeps the port's `(layers, elapsedMs)`
 * signature while the concrete engine stays a pure function of its inputs.
 */
export function createGrowthEngine(
  options: GrowthEngineOptions,
): (layers: CityLayers, elapsedMs: number) => CityLayers {
  const { seed } = options;
  return (layers, elapsedMs) => growCity(layers, elapsedMs, seed);
}
