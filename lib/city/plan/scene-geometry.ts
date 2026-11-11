import type { CityPlan } from './city-plan.types';

/**
 * Derived geometry for the renderer that is still pure (CR6.T6b): no three.js,
 * just typed arrays, so it can be tested without WebGL.
 */

/** A window band is a little wider than its floor body and `BAND_HEIGHT_RATIO` as tall. */
export const BAND_OUTSET = 0.02;
export const BAND_HEIGHT_RATIO = 0.3;

/** Roads are laid just above the floor plane to avoid z-fighting. */
export const ROAD_HEIGHT = 0.01;

/**
 * One window-band matrix per floor matrix: the same center, slightly wider,
 * and a thin slice of the floor's height. Column-major 4 × 4, 16 floats each.
 */
export function windowBandMatrices(floorMatrices: Float32Array): Float32Array {
  const bands = new Float32Array(floorMatrices.length);
  for (let i = 0; i + 16 <= floorMatrices.length; i += 16) {
    bands[i] = (floorMatrices[i] ?? 0) * (1 + BAND_OUTSET);
    bands[i + 5] = (floorMatrices[i + 5] ?? 0) * BAND_HEIGHT_RATIO;
    bands[i + 10] = (floorMatrices[i + 10] ?? 0) * (1 + BAND_OUTSET);
    bands[i + 12] = floorMatrices[i + 12] ?? 0;
    bands[i + 13] = floorMatrices[i + 13] ?? 0;
    bands[i + 14] = floorMatrices[i + 14] ?? 0;
    bands[i + 15] = 1;
  }
  return bands;
}

/** Two upward-facing triangles (18 floats) per road segment, centered on the origin. */
export function roadVertices(plan: Pick<CityPlan, 'roads' | 'bounds'>): Float32Array {
  const out = new Float32Array(plan.roads.length * 18);
  plan.roads.forEach((road, index) => {
    const x0 = road.x - plan.bounds.width / 2;
    const z0 = road.z - plan.bounds.depth / 2;
    const [x1, z1] = [x0 + road.w, z0 + road.d];
    const y = ROAD_HEIGHT;
    out.set(
      [x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0],
      index * 18,
    );
  });
  return out;
}

/** A copy of an RGB array with every channel multiplied by `factor`. */
export function scaleColors(colors: Float32Array, factor: number): Float32Array {
  return colors.map((channel) => channel * factor);
}

/**
 * Corners of a label quad as 12 floats (bottom-left, bottom-right, top-right,
 * top-left): its bottom center sits on `anchor`, and it spreads along the
 * camera's `right` and `up` so it always faces the view.
 */
export function labelQuad(
  anchor: readonly [number, number, number],
  width: number,
  height: number,
  right: readonly [number, number, number],
  up: readonly [number, number, number],
): number[] {
  const corner = (sx: number, sy: number): number[] =>
    [0, 1, 2].map((i) => (anchor[i] ?? 0) + (right[i] ?? 0) * sx * (width / 2) + (up[i] ?? 0) * sy * height);
  return [...corner(-1, 0), ...corner(1, 0), ...corner(1, 1), ...corner(-1, 1)];
}
