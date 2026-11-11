import type {
  Footprint,
  GroundPlan,
  Lot,
  RoadLayout,
  RoadSegment,
} from './city-plan.types';
import { GROUND_DEPTH, GROUND_WIDTH } from './limits';
import { nextInt, pickWeighted, type SeededRandom } from './rng';

type Blocked = boolean[][];

const UNIT: Footprint = { w: 1, d: 1, weight: 0 };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** The roads of a layout, moved by `offset` and clipped to the ground. */
export function placeRoads(
  layout: RoadLayout,
  offset: { readonly x: number; readonly z: number },
): RoadSegment[] {
  const segments: RoadSegment[] = [];
  for (const road of layout.roads) {
    const alongX = road.axis === 'x';
    const at = road.at + (alongX ? offset.z : offset.x);
    const from = road.from + (alongX ? offset.x : offset.z);
    const to = road.to + (alongX ? offset.x : offset.z);
    const limit = alongX ? GROUND_WIDTH : GROUND_DEPTH;
    const across = alongX ? GROUND_DEPTH : GROUND_WIDTH;
    if (at < 0 || at >= across) continue;
    const start = clamp(from, 0, limit - 1);
    const end = clamp(to, 0, limit - 1);
    if (to < 0 || from >= limit) continue;
    const length = end - start + 1;
    segments.push(
      alongX
        ? { x: start, z: at, w: length, d: 1 }
        : { x: at, z: start, w: 1, d: length },
    );
  }
  return segments;
}

function createBlocked(roads: ReadonlyArray<RoadSegment>): Blocked {
  const blocked: Blocked = Array.from({ length: GROUND_DEPTH }, () =>
    Array.from({ length: GROUND_WIDTH }, () => false),
  );
  for (const road of roads) fill(blocked, road.x, road.z, road.w, road.d);
  return blocked;
}

function fill(blocked: Blocked, x: number, z: number, w: number, d: number): void {
  for (let row = z; row < z + d; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const line = blocked[row];
      if (line !== undefined) line[col] = true;
    }
  }
}

function fits(blocked: Blocked, x: number, z: number, f: Footprint): boolean {
  if (x + f.w > GROUND_WIDTH || z + f.d > GROUND_DEPTH) return false;
  for (let row = z; row < z + f.d; row += 1) {
    for (let col = x; col < x + f.w; col += 1) {
      if (blocked[row]?.[col] !== false) return false;
    }
  }
  return true;
}

/**
 * Cover every free cell with a lot, scanning rows then columns. The footprint
 * is drawn by weight; where it does not fit, the largest one that does is used
 * (always at least 1 × 1), so the lots tile the land exactly.
 */
export function packLots(
  roads: ReadonlyArray<RoadSegment>,
  rng: SeededRandom,
  footprints: ReadonlyArray<Footprint>,
): Lot[] {
  const blocked = createBlocked(roads);
  const bySize = [...footprints, UNIT].sort((a, b) => b.w * b.d - a.w * a.d);
  const lots: Lot[] = [];
  for (let z = 0; z < GROUND_DEPTH; z += 1) {
    for (let x = 0; x < GROUND_WIDTH; x += 1) {
      if (blocked[z]?.[x] !== false) continue;
      const wanted = pickWeighted(rng, footprints, (f) => f.weight) ?? UNIT;
      const chosen = [wanted, ...bySize].find((f) => fits(blocked, x, z, f)) ?? UNIT;
      fill(blocked, x, z, chosen.w, chosen.d);
      lots.push({ id: lots.length, x, z, w: chosen.w, d: chosen.d });
    }
  }
  return lots;
}

/** Pick a layout and an offset, then place its roads. */
export function planRoads(
  rng: SeededRandom,
  layouts: ReadonlyArray<RoadLayout>,
): Pick<GroundPlan, 'layoutId' | 'offset' | 'roads'> {
  const index = nextInt(rng, 0, layouts.length - 1);
  const layout = layouts[index];
  if (layout === undefined) return { layoutId: '', offset: { x: 0, z: 0 }, roads: [] };
  const offset = {
    x: nextInt(rng, -layout.maxOffset, layout.maxOffset),
    z: nextInt(rng, -layout.maxOffset, layout.maxOffset),
  };
  return { layoutId: layout.id, offset, roads: placeRoads(layout, offset) };
}
