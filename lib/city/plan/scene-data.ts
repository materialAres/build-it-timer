import type { CityPlan, PlanFloor } from './city-plan.types';
import { boxEdges, boxMatrix, EDGES_PER_BOX, type Box } from './box-geometry';
import { hexToUnitRgb } from './color-math';
import { FLOOR_BODY_RATIO, FLOOR_HEIGHT, MIN_PARTIAL_HEIGHT } from './limits';
import type { VisibleFloors } from './visible-floors';

export const EDGES_PER_FLOOR = EDGES_PER_BOX;
/**
 * Brightness of the lit window bands and of the neon edges, as a share of the
 * palette color. On a complete city every floor has a band and full edges, and
 * at full strength the bloom washed the zoomed-in city out to near white. The
 * bodies are dimmed by the renderer (`BODY_DIM`); the neon signs keep their own.
 */
export const WINDOW_BRIGHTNESS = 0.75;
export const EDGE_BRIGHTNESS = 0.85;

/** A landmark's name, anchored above it; shown once the building is complete. */
export interface SceneLabel {
  readonly building: number;
  readonly name: string;
  readonly position: readonly [number, number, number];
  /** Index in build order just past the building's last floor. */
  readonly endFloor: number;
}

/**
 * Everything the renderer needs about a plan that never changes during a
 * session, as typed arrays in build order (floor `i` of the plan is instance
 * `i`): 16 floats per matrix, 3 per color, 6 per edge segment (2 points).
 * Built once per plan; growth only changes how many instances are drawn.
 */
export interface ScenePlan {
  readonly floorCount: number;
  readonly matrices: Float32Array;
  readonly colors: Float32Array;
  readonly windowColors: Float32Array;
  readonly edges: Float32Array;
  readonly edgeColors: Float32Array;
  readonly labels: ReadonlyArray<SceneLabel>;
}

/** The partly paid top floor: its own scaled matrix and edges, and its state. */
export interface PartialFloor {
  readonly index: number;
  readonly fraction: number;
  readonly damaged: boolean;
  readonly matrix: Float32Array;
  readonly edges: Float32Array;
}

/** What to draw now: how many instances and edge segments, the partial floor, the labels. */
export interface SceneFrame {
  readonly instanceCount: number;
  readonly edgeSegmentCount: number;
  readonly partial: PartialFloor | null;
  /** Indexes into `ScenePlan.labels`. */
  readonly labels: ReadonlyArray<number>;
}

/** The box of a floor in world units, centered on the ground; `fraction` shortens it. */
function floorBox(plan: CityPlan, floor: PlanFloor, fraction: number): Box | undefined {
  const section = plan.buildings[floor.building]?.sections[floor.section];
  if (section === undefined) return undefined;
  const { rect } = section;
  const sy = FLOOR_HEIGHT * FLOOR_BODY_RATIO * fraction;
  return {
    cx: rect.x + rect.w / 2 - plan.bounds.width / 2,
    cy: floor.level * FLOOR_HEIGHT + sy / 2,
    cz: rect.z + rect.d / 2 - plan.bounds.depth / 2,
    sx: rect.w,
    sy,
    sz: rect.d,
  };
}

function labelsOf(plan: CityPlan): SceneLabel[] {
  const last = new Map<number, number>();
  plan.floors.forEach((floor, index) => last.set(floor.building, index));
  return plan.buildings.flatMap((b) => {
    const lot = plan.lots[b.lotId];
    if (!b.landmark || b.name === null || lot === undefined) return [];
    const position = [
      lot.x + lot.w / 2 - plan.bounds.width / 2,
      (b.height + 1) * FLOOR_HEIGHT,
      lot.z + lot.d / 2 - plan.bounds.depth / 2,
    ] as const;
    return [{ building: b.id, name: b.name, position, endFloor: (last.get(b.id) ?? -1) + 1 }];
  });
}

/** Typed arrays for every floor of the plan (pure; call once per plan). */
export function createScenePlan(plan: CityPlan): ScenePlan {
  const count = plan.totalFloors;
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const windowColors = new Float32Array(count * 3);
  const edges = new Float32Array(count * EDGES_PER_FLOOR * 6);
  const edgeColors = new Float32Array(count * EDGES_PER_FLOOR * 6);
  plan.floors.forEach((floor, index) => {
    const box = floorBox(plan, floor, 1);
    const building = plan.buildings[floor.building];
    if (box === undefined || building === undefined) return;
    matrices.set(boxMatrix(box), index * 16);
    const body = hexToUnitRgb(building.color);
    colors.set(body, index * 3);
    windowColors.set(hexToUnitRgb(building.windowColor).map((c) => c * WINDOW_BRIGHTNESS), index * 3);
    const edge = body.map((c) => c * EDGE_BRIGHTNESS);
    edges.set(boxEdges(box), index * EDGES_PER_FLOOR * 6);
    for (let v = 0; v < EDGES_PER_FLOOR * 2; v += 1) {
      edgeColors.set(edge, (index * EDGES_PER_FLOOR * 2 + v) * 3);
    }
  });
  return { floorCount: count, matrices, colors, windowColors, edges, edgeColors, labels: labelsOf(plan) };
}

function partialOf(
  plan: CityPlan,
  visible: VisibleFloors,
  floorCount: number,
): PartialFloor | null {
  const floor = plan.floors[visible.complete];
  if (visible.partialFraction <= 0 || visible.complete >= floorCount || floor === undefined) {
    return null;
  }
  const fraction = Math.max(visible.partialFraction, MIN_PARTIAL_HEIGHT);
  const box = floorBox(plan, floor, fraction);
  if (box === undefined) return null;
  return {
    index: visible.complete,
    fraction: visible.partialFraction,
    damaged: visible.damaged,
    matrix: new Float32Array(boxMatrix(box)),
    edges: new Float32Array(boxEdges(box)),
  };
}

/** The draw state for the visible floors of a plan (pure and cheap: no big arrays). */
export function createSceneFrame(
  scene: ScenePlan,
  plan: CityPlan,
  visible: VisibleFloors,
): SceneFrame {
  const complete = Math.min(Math.max(0, visible.complete), scene.floorCount);
  const partial = partialOf(plan, { ...visible, complete }, scene.floorCount);
  const instanceCount = complete + (partial === null ? 0 : 1);
  return {
    instanceCount,
    edgeSegmentCount: instanceCount * EDGES_PER_FLOOR,
    partial,
    labels: scene.labels.flatMap((label, index) => (complete >= label.endFloor ? [index] : [])),
  };
}
