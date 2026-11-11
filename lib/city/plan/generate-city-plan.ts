import type { GroundOptions, GroundPlan, Lot, RoadSegment } from './city-plan.types';
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
import type { Footprint } from './city-plan.types';

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

/**
 * The ground plan of a session (CR6.T2a): a road layout, shifted by a random
 * offset, and the lots that tile the land around it. Pure: everything random
 * comes from `seed` (§1.4), so the same seed always gives the same plan.
 * Layouts and footprints are data; pass others through `options` or edit
 * `road-layouts.ts`. CR6.T2b extends the result with buildings.
 */
export function generateCityPlan(
  seed: number,
  options: GroundOptions = {},
): GroundPlan {
  const rng = createRng(seed);
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
