import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { DAMAGED_EDGE_COLOR, ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';
import { EDGES_PER_FLOOR, type SceneFrame, type ScenePlan } from '@/lib/city/plan/scene-data';
import { roadVertices, scaleColors, windowBandMatrices } from '@/lib/city/plan/scene-geometry';

/** Bodies stay dark so the neon edges and windows carry the color (sketch D); a floor under construction is half as bright again. */
const BODY_DIM = 0.12;
const PARTIAL_DIM = 0.5;
const FLOATS_PER_EDGE_SLOT = EDGES_PER_FLOOR * 6;

export interface CityMeshesInput {
  readonly scene: ScenePlan;
  readonly plan: CityPlan;
}

export interface CityMeshes {
  readonly group: Group;
  /** Show the floors of a frame: instance counts, edge range and the partial floor. */
  applyFrame(frame: SceneFrame): void;
  dispose(): void;
}

function instanced(
  geometry: BoxGeometry,
  matrices: Float32Array,
  colors: Float32Array,
  count: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ color: 0xffffff }), count);
  mesh.instanceMatrix.array.set(matrices);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

function environment(plan: CityPlan): Mesh[] {
  const { width, depth } = plan.bounds;
  const ground = new Mesh(
    new PlaneGeometry(width + 2, depth + 2),
    new MeshBasicMaterial({ color: ENVIRONMENT_COLORS.floor }),
  );
  ground.rotation.x = -Math.PI / 2;
  const roadGeometry = new BufferGeometry();
  roadGeometry.setAttribute('position', new BufferAttribute(roadVertices(plan), 3));
  const roads = new Mesh(
    roadGeometry,
    new MeshBasicMaterial({ color: ENVIRONMENT_COLORS.grid, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  return [ground, roads];
}

function grid(plan: CityPlan): GridHelper {
  const size = Math.max(plan.bounds.width, plan.bounds.depth);
  const helper = new GridHelper(size, size, ENVIRONMENT_COLORS.grid, ENVIRONMENT_COLORS.grid);
  helper.material.transparent = true;
  helper.material.opacity = 0.22;
  helper.position.y = 0.005;
  return helper;
}

interface FloorMeshes {
  readonly bodies: InstancedMesh;
  readonly bands: InstancedMesh;
  readonly bandMatrices: Float32Array;
  readonly bodyColors: Float32Array;
}

function floorMeshes(scene: ScenePlan): FloorMeshes {
  const box = new BoxGeometry(1, 1, 1);
  const bandMatrices = windowBandMatrices(scene.matrices);
  const bodyColors = scaleColors(scene.colors, BODY_DIM);
  return {
    bodies: instanced(box, scene.matrices, bodyColors, scene.floorCount),
    bands: instanced(box, bandMatrices, scene.windowColors, scene.floorCount),
    bandMatrices,
    bodyColors,
  };
}

interface EdgeLines {
  readonly edges: LineSegments;
  readonly geometry: BufferGeometry;
  readonly positions: BufferAttribute;
  readonly colors: BufferAttribute;
}

/** One line mesh over copies of the scene's edge arrays, so the scene data is never written. */
function edgeLines(scene: ScenePlan): EdgeLines {
  const geometry = new BufferGeometry();
  const positions = new BufferAttribute(new Float32Array(scene.edges), 3);
  const colors = new BufferAttribute(new Float32Array(scene.edgeColors), 3);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  const edges = new LineSegments(geometry, new LineBasicMaterial({ vertexColors: true }));
  edges.frustumCulled = false;
  return { edges, geometry, positions, colors };
}

interface SlotWriter {
  restore(slot: number): void;
  writePartial(partial: NonNullable<SceneFrame['partial']>): void;
}

/** Writes one floor slot back to its full-height data, or over it as the partly paid floor. */
function slotWriter(scene: ScenePlan, floors: FloorMeshes, lines: EdgeLines): SlotWriter {
  const { bodies, bands, bandMatrices, bodyColors } = floors;
  const edgeRange = (slot: number): [number, number] => [slot * FLOATS_PER_EDGE_SLOT, (slot + 1) * FLOATS_PER_EDGE_SLOT];
  return {
    restore(slot): void {
      bodies.instanceMatrix.array.set(scene.matrices.subarray(slot * 16, slot * 16 + 16), slot * 16);
      bands.instanceMatrix.array.set(bandMatrices.subarray(slot * 16, slot * 16 + 16), slot * 16);
      bodies.instanceColor?.array.set(bodyColors.subarray(slot * 3, slot * 3 + 3), slot * 3);
      const [from, to] = edgeRange(slot);
      lines.positions.array.set(scene.edges.subarray(from, to), from);
      lines.colors.array.set(scene.edgeColors.subarray(from, to), from);
    },
    writePartial(partial): void {
      const slot = partial.index;
      bodies.instanceMatrix.array.set(partial.matrix, slot * 16);
      // A floor under construction has no lit windows yet: a zero-height band.
      const [tx = 0, ty = 0, tz = 0] = partial.matrix.subarray(12, 15);
      const hidden = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, tx, ty, tz, 1]);
      bands.instanceMatrix.array.set(hidden, slot * 16);
      const dim = bodyColors.subarray(slot * 3, slot * 3 + 3).map((c) => c * PARTIAL_DIM);
      bodies.instanceColor?.array.set(dim, slot * 3);
      const [from, to] = edgeRange(slot);
      lines.positions.array.set(partial.edges, from);
      const red = hexToUnitRgb(DAMAGED_EDGE_COLOR);
      const paint = scene.edgeColors
        .subarray(from, to)
        .map((channel, i) => (partial.damaged ? (red[i % 3] ?? 0) : channel * PARTIAL_DIM));
      lines.colors.array.set(paint, from);
    },
  };
}

const sameFrame = (a: SceneFrame, b: SceneFrame): boolean =>
  a.instanceCount === b.instanceCount &&
  a.partial?.index === b.partial?.index &&
  a.partial?.fraction === b.partial?.fraction &&
  a.partial?.damaged === b.partial?.damaged;

/**
 * The city as six draw calls (CR6.T6b): ground, grid, roads, the floor bodies
 * and their window bands as two instanced meshes, and every edge as one line
 * mesh. All floors of the plan are uploaded once; a frame only changes how many
 * are shown and rewrites the single partly paid floor.
 */
export function createCityMeshes({ scene, plan }: CityMeshesInput): CityMeshes {
  const floors = floorMeshes(scene);
  const lines = edgeLines(scene);
  const writer = slotWriter(scene, floors, lines);
  const group = new Group();
  group.add(...environment(plan), grid(plan), floors.bodies, floors.bands, lines.edges);

  let shown: SceneFrame | null = null;
  let disposed = false;
  return {
    group,
    applyFrame(frame): void {
      if (disposed || (shown !== null && sameFrame(shown, frame))) return;
      if (shown?.partial) writer.restore(shown.partial.index);
      if (frame.partial) writer.writePartial(frame.partial);
      floors.bodies.count = frame.instanceCount;
      floors.bands.count = frame.instanceCount;
      lines.geometry.setDrawRange(0, frame.edgeSegmentCount * 2);
      const touched = [floors.bodies.instanceMatrix, floors.bands.instanceMatrix, floors.bodies.instanceColor, lines.positions, lines.colors];
      for (const attribute of touched) if (attribute) attribute.needsUpdate = true;
      shown = frame;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.traverse((object) => {
        const { geometry, material } = object as { geometry?: { dispose(): void }; material?: { dispose(): void } };
        geometry?.dispose();
        material?.dispose();
      });
      floors.bodies.dispose();
      floors.bands.dispose();
    },
  };
}
