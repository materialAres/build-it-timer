/**
 * Fixed bounds of a city plan (CR6.T1, `docs/features-analysis/city-3d.md` §3).
 * The single place the generator and the renderer read them from, so a plan
 * always fits the one camera frame.
 */

/** Ground size in cells (x by z). */
export const GROUND_WIDTH = 12;
export const GROUND_DEPTH = 10;

/** Lots per plan. Packing is retried until the count is inside this range. */
export const MIN_LOTS = 30;
export const MAX_LOTS = 48;

/** Packing attempts before the closest one is accepted. */
export const MAX_LOT_ATTEMPTS = 12;

/**
 * Buildings (CR6.T2b). The total floors bound is derived from the lot bounds
 * above: 30–48 lots with 2–16 floors each, plus 1–3 landmarks, fit 200–300
 * floors, i.e. 2–3 characters per floor of the 600 a session is worth.
 */
export const MIN_TOTAL_FLOORS = 200;
export const MAX_TOTAL_FLOORS = 300;

/** The tallest building, landmarks included, in levels. */
export const MAX_BUILDING_FLOORS = 32;

export const MIN_LANDMARKS = 1;
export const MAX_LANDMARKS = 3;

/** Share of the lots left empty as parks. */
export const MAX_PARK_SHARE = 0.1;

export const MAX_LAMPS = 40;
export const MAX_SIGNS = 12;
export const MAX_BEACONS = 4;

/** Height adjustments before the floor fit gives up (custom data only). */
export const MAX_FIT_STEPS = 2000;

/** Hue shift of a session palette, in degrees either way (CR6.T3). */
export const MAX_HUE_SHIFT = 25;
