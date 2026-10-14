import type {
  BuildingModule,
  BuildingModuleCategory,
  CityCell,
  CityGrid,
  CityLayers,
  CityLayerName,
  ComposedBuilding,
  SeededRandom,
} from '@/components/city/city.types';
import { hashString } from '@/utils/hash';
import {
  STREET_PROPS,
  maxStreetPropRows,
  streetPropWidth,
} from './street-props';
import { TILE_BASE_WIDTH, getModulesByCategory } from './tile-library';

/**
 * Growth cadence: one character of city per 2 seconds of undistracted focus
 * (roadmap M2.T12). Distinct from the 60s `browser.alarms` persistence clock
 * (M1.T5): it is recalculated from the elapsed focus time, never alarm-driven.
 */
export const GROWTH_TICK_MS = 2000;

/**
 * SCENE LAYOUT — three layers stacked vertically, never overlapping, so the
 * result does not depend on how the renderer composites them:
 *
 *   foreground   (layer 1) → the street: road + trees, lamps, cars, benches
 *   middleground (layer 2) → the houses: complete buildings with a roof
 *   background   (layer 3) → the sky: stars
 *
 * Growth rotates in that order: street, houses, sky.
 */
const GROWTH_LAYER_ORDER: ReadonlyArray<CityLayerName> = [
  'foreground',
  'middleground',
  'background',
];

const SKY_MIN_GRID_HEIGHT = 10; // below this the grid is too short for a sky
const SKY_SHARE = 0.2;
const STREET_MAX_SHARE = 0.3; // the street never takes more than this of the grid

/**
 * The rows each layer owns. The street is exactly as tall as its tallest prop
 * plus the road row, so a prop always touches the road and the houses (which
 * stand on a pavement row at the bottom of their band) sit right on top of it —
 * nothing floats.
 */
function bandOf(
  grid: CityGrid,
  layer: CityLayerName,
): { top: number; height: number } {
  const total = grid.height;
  const street = Math.max(
    1,
    Math.min(1 + maxStreetPropRows(), Math.floor(total * STREET_MAX_SHARE)),
  );
  const sky = total >= SKY_MIN_GRID_HEIGHT ? Math.round(total * SKY_SHARE) : 0;
  const city = Math.max(1, total - sky - street);

  const top =
    layer === 'background' ? 0 : layer === 'middleground' ? sky : sky + city;
  const wanted =
    layer === 'background' ? sky : layer === 'middleground' ? city : street;
  return { top, height: Math.max(0, Math.min(wanted, total - top)) };
}

/** Glyphs. */
const STAR_GLYPHS: ReadonlyArray<string> = ['.', '.', '*', '+'];
const STAR_DENSITY = 0.06; // fraction of sky cells that hold a star
const ROAD_GLYPH = '=';
const PAVEMENT_GLYPH = '_';

/** Houses layout. */
/**
 * Floors per house, drawn at random. `max` is a *minimum* ceiling, not an
 * absolute one: a band tall enough to fit more floors raises it (see
 * `buildHouse`), so a taller grid yields taller houses instead of leaving the
 * extra rows permanently empty. It still bounds variety on short bands.
 */
const FLOORS_RANGE = { min: 1, max: 4 } as const;
const HOUSE_GAP = { min: 1, max: 3 } as const;
const WIDE_GAP_CHANCE = 0.15; // occasional plaza between houses
const WIDE_GAP_EXTRA = { min: 2, max: 4 } as const;

/** Street layout. */
const PROP_CHANCE = 0.55;
const ROAD_SEGMENT = { min: 2, max: 5 } as const;

/** Per-layer seed offset, so the layers never share the same random draws. */
const LAYER_SEED_OFFSET: Readonly<Record<CityLayerName, number>> = {
  background: 0x85ebca6b,
  middleground: 0xc2b2ae35,
  foreground: 0x27d4eb2f,
};

function ticksFor(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  return Math.max(0, Math.floor(elapsedMs / GROWTH_TICK_MS));
}

/** Minimal deterministic PRNG (mulberry32). */
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

function randInt(rng: SeededRandom, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

function pickOne<T>(items: ReadonlyArray<T>, rng: SeededRandom): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng.next() * items.length))];
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

/** A rectangular slot of a layer in which one structure is raised. */
interface Lot {
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
}

/** A lot together with the complete structure that will be raised in it. */
interface LotPlan {
  readonly lot: Lot;
  readonly building: ComposedBuilding;
}

/**
 * The glyph a structure contributes at a given offset inside its lot, or `null`
 * outside its silhouette. Looked up **by position**; the structure is
 * bottom-anchored, so it rises from the lot's last row.
 */
function glyphAt(
  building: ComposedBuilding,
  rowInLot: number,
  colInLot: number,
  lotHeight: number,
): string | null {
  const height = building.rows.length;
  if (height === 0) return null;

  const buildingRow = rowInLot - (lotHeight - height);
  if (buildingRow < 0 || buildingRow >= height) return null;

  const row = building.rows[buildingRow];
  if (row === undefined) return null;

  const glyph = row.charAt(colInLot);
  return glyph === '' || glyph === ' ' ? null : glyph;
}

/* ------------------------------------------------------------------ SKY --- */

/**
 * Stars scattered over the sky band. Positions come from a seeded shuffle, so
 * they appear one at a time in random order and are identical for a session.
 */
function planSky(
  grid: CityGrid,
  band: { top: number; height: number },
  layerSeed: number,
): ReadonlyArray<LotPlan> {
  if (band.height <= 0 || grid.width <= 0) return [];
  const rng = createSeededRandom(layerSeed);

  const cells = Array.from({ length: band.height * grid.width }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const a = cells[i];
    const b = cells[j];
    if (a === undefined || b === undefined) continue;
    cells[i] = b;
    cells[j] = a;
  }

  const count = Math.max(1, Math.round(cells.length * STAR_DENSITY));
  return cells.slice(0, count).map((index): LotPlan => {
    const glyph =
      STAR_GLYPHS[Math.floor(rng.next() * STAR_GLYPHS.length)] ?? '.';
    return {
      lot: {
        row: band.top + Math.floor(index / grid.width),
        col: index % grid.width,
        width: 1,
        height: 1,
      },
      building: { moduleIds: [], rows: [glyph], widthChars: 1 },
    };
  });
}

/* --------------------------------------------------------------- HOUSES --- */

function padRow(row: string, widthChars: number): string {
  if (row.length >= widthChars) return row;
  const total = widthChars - row.length;
  const leading = Math.floor(total / 2);
  return ' '.repeat(leading) + row + ' '.repeat(total - leading);
}

function modulesOf(
  category: BuildingModuleCategory,
): ReadonlyArray<BuildingModule> {
  return getModulesByCategory(category);
}

/**
 * Last-resort house, used only when the band is too short for base + roof: a
 * pitched roof over a wall. It is complete (it always has a roof) at 2 rows.
 */
function fallbackHouse(): ComposedBuilding {
  const w = Math.max(4, TILE_BASE_WIDTH);
  return {
    moduleIds: [],
    rows: [`/${'-'.repeat(w - 2)}\\`, `|${'_'.repeat(w - 2)}|`],
    widthChars: w,
  };
}

/**
 * One COMPLETE house: a base, a random number of floors and a roof (the `top`
 * module), stacked top → bottom. The number of floors is drawn at random and
 * then clamped to what fits in `maxRows`, so houses have different heights but
 * are never cut and never lose their roof: the roof and the base are reserved
 * first and the floors only use the remaining budget.
 *
 * The draw's ceiling is raised to the whole remaining budget, so a tall band is
 * filled with tall houses instead of leaving its top rows empty forever.
 * `FLOORS_RANGE.max` therefore only sets the *minimum* ceiling — the variety
 * floor for short bands — never a hard cap.
 *
 * This replaces the previous approach (composeBuilding at a random "stage"),
 * which dropped the roof from every house that was not the tallest one.
 */
function buildHouse(rng: SeededRandom, maxRows: number): ComposedBuilding {
  const base = pickOne(modulesOf('base'), rng);
  const top = pickOne(modulesOf('top'), rng);
  if (base === undefined || top === undefined) return fallbackHouse();

  let budget = maxRows - base.rows.length - top.rows.length;
  if (budget < 0) return fallbackHouse();

  const floors: BuildingModule[] = [];
  const wanted = randInt(
    rng,
    FLOORS_RANGE.min,
    Math.max(FLOORS_RANGE.min, budget),
  );
  const floorVariants = modulesOf('floor');
  for (let i = 0; i < wanted; i += 1) {
    const floor = pickOne(floorVariants, rng);
    if (floor === undefined || floor.rows.length > budget) break;
    floors.push(floor);
    budget -= floor.rows.length;
  }

  // Visual order, top → bottom: roof, floors, base.
  const stack = [top, ...floors, base];
  const widthChars = stack.reduce((max, m) => Math.max(max, m.widthChars), 1);
  return {
    moduleIds: stack.map((m) => m.id),
    rows: stack.flatMap((m) => m.rows.map((row) => padRow(row, widthChars))),
    widthChars,
  };
}

/** A strip of pavement `width` wide: the ground houses stand on. */
function pavement(width: number): ComposedBuilding {
  return {
    moduleIds: [],
    rows: [PAVEMENT_GLYPH.repeat(width)],
    widthChars: width,
  };
}

/**
 * The houses of the skyline: complete houses of different heights, left →
 * right, separated by gaps. The whole band bottom is a continuous pavement row
 * (under the houses and under the gaps), so houses stand on the ground right
 * above the road instead of floating.
 */
function planHouses(
  grid: CityGrid,
  band: { top: number; height: number },
  layerSeed: number,
): ReadonlyArray<LotPlan> {
  if (band.height <= 0 || grid.width <= 0) return [];
  const rng = createSeededRandom(layerSeed);
  const maxHouseRows = Math.max(1, band.height - 1); // one row is the pavement

  const toPlan = (col: number, width: number, b: ComposedBuilding): LotPlan => ({
    lot: { row: band.top, col, width, height: band.height },
    building: b,
  });

  const plans: LotPlan[] = [];
  let col = 0;
  let index = 0;

  while (col < grid.width) {
    let gap =
      index === 0
        ? randInt(rng, 0, HOUSE_GAP.min)
        : randInt(rng, HOUSE_GAP.min, HOUSE_GAP.max);
    if (rng.next() < WIDE_GAP_CHANCE) {
      gap += randInt(rng, WIDE_GAP_EXTRA.min, WIDE_GAP_EXTRA.max);
    }
    gap = Math.min(gap, grid.width - col);
    if (gap > 0) {
      plans.push(toPlan(col, gap, pavement(gap)));
      col += gap;
    }
    if (col >= grid.width) break;

    const house = buildHouse(rng, maxHouseRows);
    const width = Math.max(1, house.widthChars);
    if (col + width > grid.width) {
      // No room for another house: finish the row with pavement only.
      const rest = grid.width - col;
      plans.push(toPlan(col, rest, pavement(rest)));
      break;
    }

    plans.push(
      toPlan(col, width, {
        moduleIds: house.moduleIds,
        rows: [...house.rows, PAVEMENT_GLYPH.repeat(width)],
        widthChars: width,
      }),
    );
    col += width;
    index += 1;
  }
  return plans;
}

/* --------------------------------------------------------------- STREET --- */

/**
 * A continuous road along the whole bottom row, with trees, lamps, cars and
 * benches standing on it. The layer is a sequence of segments left → right;
 * each segment is a stretch of road, optionally with a prop on top, so the road
 * and its furniture grow together. Two props are never adjacent.
 */
function planStreet(
  grid: CityGrid,
  band: { top: number; height: number },
  layerSeed: number,
): ReadonlyArray<LotPlan> {
  if (band.height <= 0 || grid.width <= 0) return [];
  const rng = createSeededRandom(layerSeed);
  const props = STREET_PROPS.filter((p) => p.rows.length + 1 <= band.height);

  const plans: LotPlan[] = [];
  let col = 0;
  let lastWasProp = false;

  while (col < grid.width) {
    const remaining = grid.width - col;
    const wantsProp = props.length > 0 && !lastWasProp && rng.next() < PROP_CHANCE;
    const prop = wantsProp ? pickOne(props, rng) : undefined;

    let rows: string[];
    let width: number;
    if (prop !== undefined && streetPropWidth(prop) <= remaining) {
      width = streetPropWidth(prop);
      rows = [...prop.rows, ROAD_GLYPH.repeat(width)];
      lastWasProp = true;
    } else {
      width = Math.min(remaining, randInt(rng, ROAD_SEGMENT.min, ROAD_SEGMENT.max));
      rows = [ROAD_GLYPH.repeat(width)];
      lastWasProp = false;
    }

    plans.push({
      lot: { row: band.top, col, width, height: band.height },
      building: { moduleIds: [], rows, widthChars: width },
    });
    col += width;
  }
  return plans;
}

/* --------------------------------------------------------------- GROWTH --- */

function planLayer(
  grid: CityGrid,
  layer: CityLayerName,
  seed: number,
): ReadonlyArray<LotPlan> {
  const band = bandOf(grid, layer);
  const layerSeed = seed + LAYER_SEED_OFFSET[layer];
  switch (layer) {
    case 'background':
      return planSky(grid, band, layerSeed);
    case 'middleground':
      return planHouses(grid, band, layerSeed);
    case 'foreground':
      return planStreet(grid, band, layerSeed);
  }
}

/**
 * The next cell to fill in a lot: bottom row → top row, left → right, skipping
 * offsets outside the silhouette. `null` when the lot is complete.
 */
function nextFreeCellInLot(
  grid: CityGrid,
  plan: LotPlan,
): { row: number; col: number; glyph: string } | null {
  const { lot, building } = plan;
  for (let rowInLot = lot.height - 1; rowInLot >= 0; rowInLot -= 1) {
    for (let colInLot = 0; colInLot < lot.width; colInLot += 1) {
      const glyph = glyphAt(building, rowInLot, colInLot, lot.height);
      if (glyph === null) continue;
      const row = lot.row + rowInLot;
      const col = lot.col + colInLot;
      const cell = grid.cells[row]?.[col];
      if (cell !== undefined && cell.char === null) return { row, col, glyph };
    }
  }
  return null;
}

function nextFreeSlot(
  grid: CityGrid,
  plans: ReadonlyArray<LotPlan>,
): { row: number; col: number; glyph: string } | null {
  for (const plan of plans) {
    const slot = nextFreeCellInLot(grid, plan);
    if (slot !== null) return slot;
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
 * Pick the layer for the character at global tick `tick`: rotating
 * street → houses → sky, skipping full layers. `null` when every layer is full
 * (the visual cap).
 */
function pickLayer(
  layers: CityLayers,
  tick: number,
  plans: Readonly<Record<CityLayerName, ReadonlyArray<LotPlan>>>,
): CityLayerName | null {
  const start = tick % GROWTH_LAYER_ORDER.length;
  for (let offset = 0; offset < GROWTH_LAYER_ORDER.length; offset += 1) {
    const candidate =
      GROWTH_LAYER_ORDER[(start + offset) % GROWTH_LAYER_ORDER.length];
    if (
      candidate !== undefined &&
      nextFreeSlot(layers[candidate], plans[candidate]) !== null
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Grow the three city layers by the undistracted focus time elapsed since the
 * last call (roadmap M2.T12). Every 2 seconds inserts exactly **one** character
 * — never a whole module at once.
 *
 * Pure and deterministic: same `(layers, elapsedMs, seed)` → deep-equal result,
 * no `Date.now()`/`Math.random()`. The scene layout is derived from the seed and
 * the grid dimensions only, never from how much is already built, so it cannot
 * stall. When all three layers are full it returns the *same* `CityLayers`
 * reference (visual cap, not an error).
 */
export function growCity(
  layers: CityLayers,
  elapsedMs: number,
  seed = 0,
): CityLayers {
  const ticks = ticksFor(elapsedMs);
  if (ticks === 0) return layers;

  const plans: Record<CityLayerName, ReadonlyArray<LotPlan>> = {
    background: planLayer(layers.background, 'background', seed),
    middleground: planLayer(layers.middleground, 'middleground', seed),
    foreground: planLayer(layers.foreground, 'foreground', seed),
  };

  let current = layers;
  // The tick index only drives the layer rotation; it starts from the
  // characters already standing so a resumed session continues the rotation.
  const placedBefore =
    countOccupied(layers.background) +
    countOccupied(layers.middleground) +
    countOccupied(layers.foreground);

  for (let index = 0; index < ticks; index += 1) {
    const layer = pickLayer(current, placedBefore + index, plans);
    if (layer === null) break; // all layers full: the visual cap

    const slot = nextFreeSlot(current[layer], plans[layer]);
    if (slot === null) break; // unreachable once `pickLayer` checked it

    current = placeCell(current, layer, slot.row, slot.col, { char: slot.glyph });
  }

  return current;
}

/** Collaborators/parameters the growth engine is built with. */
export interface GrowthEngineOptions {
  /** Seed derived from the session id (wiring is M2.T15). */
  readonly seed: number;
}

/** Deterministic session → growth seed mapping (M2.T15). */
export function seedFromSession(sessionId: string | null): number {
  return hashString(sessionId ?? '');
}

/** Convenience adapter that binds a fixed seed once. */
export function createGrowthEngine(
  options: GrowthEngineOptions,
): (layers: CityLayers, elapsedMs: number) => CityLayers {
  const { seed } = options;
  return (layers, elapsedMs) => growCity(layers, elapsedMs, seed);
}
