import { BufferAttribute, BufferGeometry, GridHelper, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';
import { EDGES_PER_FLOOR, type SceneFrame, type ScenePlan } from '@/lib/city/plan/scene-data';
import { roadVertices } from '@/lib/city/plan/scene-geometry';
import { edgeLines, floorMeshes, slotWriter, type SlotWriter } from './floor-slots';

export interface CityMeshesInput {
  readonly scene: ScenePlan;
  readonly plan: CityPlan;
}

export interface CityMeshes {
  readonly group: Group;
  /** Show the floors of a frame: instance counts, edge range and the partial floor. */
  applyFrame(frame: SceneFrame): void;
  /** Draws single floor slots (animations, window flicker); see `floor-slots.ts`. */
  readonly slots: SlotWriter;
  /** How many floors, and their edges, are drawn (animations show removed floors a little longer). */
  setVisibleCount(count: number): void;
  dispose(): void;
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
  const slots = slotWriter(scene, floors, lines);
  const group = new Group();
  group.add(...environment(plan), grid(plan), floors.bodies, floors.bands, lines.edges);

  let shown: SceneFrame | null = null;
  let disposed = false;
  const setVisibleCount = (count: number): void => {
    floors.bodies.count = count;
    floors.bands.count = count;
    lines.geometry.setDrawRange(0, count * EDGES_PER_FLOOR * 2);
    const touched = [floors.bodies.instanceMatrix, floors.bands.instanceMatrix, floors.bodies.instanceColor, lines.positions, lines.colors];
    for (const attribute of touched) if (attribute) attribute.needsUpdate = true;
  };
  return {
    group,
    slots,
    setVisibleCount,
    applyFrame(frame): void {
      if (disposed || (shown !== null && sameFrame(shown, frame))) return;
      if (shown?.partial) slots.draw(shown.partial.index);
      if (frame.partial) slots.draw(frame.partial.index, { partial: frame.partial });
      setVisibleCount(frame.instanceCount);
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
