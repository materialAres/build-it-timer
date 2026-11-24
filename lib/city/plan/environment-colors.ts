/**
 * The fixed environment of every city (CR6.T3, DESIGN.md): black floor and a
 * phosphor-green grid, rain and HUD. Constants, never part of a session
 * palette, so the popup keeps its identity whatever the seed picks.
 */
export const ENVIRONMENT_COLORS = {
  floor: '#000000',
  grid: '#7dfba0',
  rain: '#7dfba0',
  hud: '#7dfba0',
} as const;

/** Minimum WCAG contrast of a building, window or prop color on the floor. */
export const MIN_COLOR_CONTRAST = 4.5;

/** The edges of a damaged top floor (DESIGN.md `alarm-red`): a signal, not a palette color. */
export const DAMAGED_EDGE_COLOR = '#ff6b6b';
