import type {
  CityPlan,
  Footprint,
  GroundOptions,
  GroundPlan,
  Lot,
  PlanOptions,
  RoadSegment,
} from './city-plan.types';
import { colorBuildings, colorProps, chooseStyle } from './assign-colors';
import { ARCHETYPES } from './building-archetypes';
import { CITY_PALETTES } from './city-palettes';
import { orderFloors } from './build-order';
import { placeBuildings } from './plan-buildings';
import { placeProps } from './plan-props';
import { TOWER_NAME_PARTS } from './tower-names';
import {
  GROUND_DEPTH,
  GROUND_WIDTH,
  MAX_LOTS,
  MAX_LOT_ATTEMPTS,
  MIN_LOTS,
} from './limits';
import { packLots, planRoads } from './plan-lots';
import { LOT_FOOTPRINTS, ROAD_LAYOUTS } from './road-layouts';
import { createRng, type SeededRandom } from './rng';

const distanceToRange = (count: number): number =>
  count < MIN_LOTS ? MIN_LOTS - count : Math.max(0, count - MAX_LOTS);

/**
 * Pack lots until the count is inside the bounds; after `MAX_LOT_ATTEMPTS` the
 * closest attempt wins, so the result is always deterministic and total.
 */
function packWithinBounds(
  roads: ReadonlyArray<RoadSegment>,
  rng: SeededRandom,
  footprints: ReadonlyArray<Footprint>,
): Lot[] {
  let best: Lot[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_LOT_ATTEMPTS; attempt += 1) {
    const lots = packLots(roads, rng, footprints);
    const distance = distanceToRange(lots.length);
    if (distance < bestDistance) {
      best = lots;
      bestDistance = distance;
    }
    if (distance === 0) break;
  }
  return best;
}

/** The ground plan: a road layout, shifted by a random offset, and its lots. */
function generateGroundPlan(
  seed: number,
  rng: SeededRandom,
  options: GroundOptions,
): GroundPlan {
  const layouts = options.layouts ?? ROAD_LAYOUTS;
  const footprints = options.footprints ?? LOT_FOOTPRINTS;
  const { layoutId, offset, roads } = planRoads(rng, layouts);
  return {
    seed,
    layoutId,
    offset,
    bounds: { width: GROUND_WIDTH, depth: GROUND_DEPTH },
    roads,
    lots: packWithinBounds(roads, rng, footprints),
  };
}

/**
 * The city plan of a session (CR6.T2a/T2b/T3): the ground plan, a building on
 * every lot that is not a park, the floors in build order, the props, and the
 * session palette with its hue shift. Pure: everything random comes from `seed`
 * (§1.4), so the same seed always gives the same plan. Layouts, footprints,
 * archetypes, tower names and palettes are data; pass others through `options`
 * or edit their files.
 */
export function generateCityPlan(
  seed: number,
  options: PlanOptions = {},
): CityPlan {
  const rng = createRng(seed);
  const ground = generateGroundPlan(seed, rng, options);
  const shapes = placeBuildings(
    ground,
    rng,
    options.archetypes ?? ARCHETYPES,
    options.towerNames ?? TOWER_NAME_PARTS,
  );
  const floors = orderFloors(shapes, rng);
  const propShapes = placeProps(ground, shapes, rng);
  const style = chooseStyle(rng, options.palettes ?? CITY_PALETTES);
  const buildings = colorBuildings(ground, shapes, style, rng);
  return {
    ...ground,
    paletteId: style.palette.id,
    hueShift: style.hueShift,
    buildings,
    floors,
    props: colorProps(propShapes, buildings, style),
    totalFloors: floors.length,
  };
}
