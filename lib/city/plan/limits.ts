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
