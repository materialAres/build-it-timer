import type { CityPlan, PlanFloor } from './city-plan.types';
import type { VisibleFloors } from './visible-floors';

/**
 * The plan as ASCII text (CR6.T8b), for browsers without WebGL2 or after the GPU
 * context is lost. It is a front view of the same plan and the same visible
 * floors the 3D view draws: each ground cell is a few columns wide, each floor a
 * row, nearer buildings hide farther ones. Pure and total.
 */

export const SKYLINE_ROWS = 20;
export const SKYLINE_COLUMNS_PER_CELL = 5;

const GROUND = '_';
const EDGE = '#';
const WINDOW = ':';
const BUILDING = '=';
const DAMAGED = '!';
/** The last row is the ground line; buildings use the rows above it. */
const BUILDING_ROWS = SKYLINE_ROWS - 1;

interface Canvas {
  readonly chars: string[][];
  /** Front edge (z) of what is painted in each cell, so a nearer building wins. */
  readonly depth: number[][];
}

function createCanvas(width: number): Canvas {
  return {
    chars: Array.from({ length: SKYLINE_ROWS }, () => Array.from({ length: width }, () => ' ')),
    depth: Array.from({ length: SKYLINE_ROWS }, () => Array.from({ length: width }, () => -Infinity)),
  };
}

/** Rows (counted from the ground up) one level covers; a level is at least one row. */
function levelRows(level: number, scale: number): number[] {
  const from = Math.floor(level * scale);
  const to = Math.max(from + 1, Math.floor((level + 1) * scale));
  return Array.from({ length: to - from }, (_, i) => from + i);
}

function paintFloor(
  canvas: Canvas,
  plan: CityPlan,
  floor: PlanFloor,
  scale: number,
  glyph: (column: number, first: number, last: number) => string,
): void {
  const section = plan.buildings[floor.building]?.sections[floor.section];
  if (section === undefined) return;
  const { rect } = section;
  // Sections are not always whole cells (a tower can stand on part of its lot).
  const first = Math.round(rect.x * SKYLINE_COLUMNS_PER_CELL);
  const end = Math.round((rect.x + rect.w) * SKYLINE_COLUMNS_PER_CELL);
  // A wide building leaves its last column empty, so neighbors do not run together.
  const last = Math.max(first, end - (end - first >= 4 ? 2 : 1));
  const front = rect.z + rect.d;
  for (const up of levelRows(floor.level, scale)) {
    const row = BUILDING_ROWS - 1 - up;
    const line = canvas.chars[row];
    const depth = canvas.depth[row];
    if (line === undefined || depth === undefined) continue;
    for (let column = first; column <= last && column < line.length; column += 1) {
      if ((depth[column] ?? -Infinity) > front) continue;
      line[column] = glyph(column, first, last);
      depth[column] = front;
    }
  }
}

const solid = (column: number, first: number, last: number): string =>
  column === first || column === last ? EDGE : WINDOW;

/** ASCII rows for a plan and the floors standing, exactly `SKYLINE_ROWS` rows of equal width. */
export function renderSkyline(plan: CityPlan, visible: VisibleFloors): string[] {
  const width = plan.bounds.width * SKYLINE_COLUMNS_PER_CELL;
  const canvas = createCanvas(width);
  const tallest = Math.max(1, ...plan.buildings.map((b) => b.height));
  // The scale depends on the plan only, so a building keeps its size as the city grows.
  const scale = Math.min(1, (BUILDING_ROWS - 1) / tallest);
  const complete = Number.isFinite(visible.complete)
    ? Math.min(Math.max(0, Math.floor(visible.complete)), plan.floors.length)
    : 0;
  for (const floor of plan.floors.slice(0, complete)) paintFloor(canvas, plan, floor, scale, solid);
  const next = plan.floors[complete];
  if (next !== undefined && visible.partialFraction > 0) {
    const mark = visible.damaged ? DAMAGED : BUILDING;
    paintFloor(canvas, plan, next, scale, () => mark);
  }
  const rows = canvas.chars.map((line) => line.join(''));
  rows[SKYLINE_ROWS - 1] = GROUND.repeat(width);
  return rows;
}
