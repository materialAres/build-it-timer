import { GROUND_DEPTH, GROUND_WIDTH } from './plan/limits';

/**
 * The fixed isometric framing of the city (CR6.T6a): one orthographic camera
 * that shows the whole ground and the tallest tower for every plan. Pure data
 * and arithmetic so it is testable without WebGL.
 */

/** World units visible vertically at zoom 1: the 12 × 10 ground plus the tallest tower. */
export const VIEW_SIZE = 20;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const CAMERA_HOME: Vec3 = { x: 14, y: 12, z: 14 };
export const CAMERA_TARGET: Vec3 = { x: GROUND_WIDTH * 0, y: 3, z: GROUND_DEPTH * 0 };

const HOME_AZIMUTH = Math.PI / 4;

/** The limited orbit: a quarter turn either side, never below the horizon, no pan. */
export const ORBIT_LIMITS = {
  minPolar: 0.5,
  maxPolar: 1.35,
  minAzimuth: HOME_AZIMUTH - 0.7,
  maxAzimuth: HOME_AZIMUTH + 0.7,
  minZoom: 0.8,
  maxZoom: 1.8,
} as const;

/**
 * The free orbit of the full-city page (CR6.T11): all the way round, tilted
 * from nearly overhead down to just above the horizon, zoomed further out and
 * in than the popup view, and pannable.
 */
export const FREE_ORBIT_LIMITS = {
  minPolar: 0.15,
  maxPolar: 1.5,
  minAzimuth: -Infinity,
  maxAzimuth: Infinity,
  minZoom: 0.5,
  maxZoom: 4,
} as const;

export interface Frustum {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The camera frustum for a view of the given width ÷ height; a bad aspect reads as square. */
export function frustumFor(aspect: number): Frustum {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const half = VIEW_SIZE / 2;
  return { left: -half * safe, right: half * safe, top: half, bottom: -half };
}

/** The polar and azimuth angles of a camera position around a target (as three.js measures them). */
export function orbitAnglesOf(position: Vec3, target: Vec3): { polar: number; azimuth: number } {
  const dx = position.x - target.x;
  const dy = position.y - target.y;
  const dz = position.z - target.z;
  const distance = Math.hypot(dx, dy, dz);
  return {
    polar: distance === 0 ? 0 : Math.acos(dy / distance),
    azimuth: Math.atan2(dx, dz),
  };
}
