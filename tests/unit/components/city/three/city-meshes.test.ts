import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Attr { array: Float32Array; needsUpdate: boolean }
interface Geo {
  w?: number;
  disposed: number;
  drawRange: { start: number; count: number };
  getAttribute(name: string): Attr | undefined;
}
interface Mat { params: Record<string, unknown>; disposed: number }
interface MeshLike { geometry: Geo; material: Mat }
interface InstancedLike extends MeshLike {
  count: number;
  instanceMatrix: Attr;
  instanceColor: Attr | null;
}
interface Made {
  instanced: InstancedLike[];
  lines: MeshLike[];
  meshes: MeshLike[];
  grids: object[];
  geometries: Geo[];
  materials: Mat[];
}
const made = vi.hoisted<Made>(() => ({
  instanced: [], lines: [], meshes: [], grids: [], geometries: [], materials: [],
}));

vi.mock('three', () => {
  class Disposable {
    disposed = 0;
    dispose(): void { this.disposed += 1; }
  }
  class BufferAttribute {
    needsUpdate = false;
    constructor(public array: Float32Array, public itemSize: number) {}
  }
  class InstancedBufferAttribute extends BufferAttribute {}
  class BufferGeometry extends Disposable {
    attrs: Record<string, BufferAttribute> = {};
    drawRange = { start: 0, count: Infinity };
    constructor() { super(); made.geometries.push(this); }
    setAttribute(name: string, attr: BufferAttribute): this { this.attrs[name] = attr; return this; }
    getAttribute(name: string): BufferAttribute | undefined { return this.attrs[name]; }
    setDrawRange(start: number, count: number): void { this.drawRange = { start, count }; }
  }
  class BoxGeometry extends BufferGeometry {}
  class PlaneGeometry extends BufferGeometry {
    constructor(public w: number, public h: number) { super(); }
  }
  class MeshBasicMaterial extends Disposable {
    constructor(public params: Record<string, unknown> = {}) { super(); made.materials.push(this); }
  }
  class LineBasicMaterial extends MeshBasicMaterial {}
  class Object3D {
    children: unknown[] = [];
    rotation = { x: 0 };
    position = { x: 0, y: 0, z: 0 };
    add(...c: unknown[]): this { this.children.push(...c); return this; }
    traverse(fn: (o: unknown) => void): void {
      fn(this);
      for (const c of this.children) (c as Object3D).traverse(fn);
    }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    constructor(public geometry: BufferGeometry, public material: Disposable) { super(); made.meshes.push(this as unknown as MeshLike); }
  }
  class InstancedMesh extends Mesh {
    count: number;
    instanceMatrix: BufferAttribute;
    instanceColor: BufferAttribute | null = null;
    constructor(g: BufferGeometry, m: Disposable, count: number) {
      super(g, m);
      this.count = count;
      this.instanceMatrix = new BufferAttribute(new Float32Array(count * 16), 16);
      made.instanced.push(this as unknown as InstancedLike);
    }
    dispose(): void { this.geometry.dispose(); }
  }
  class LineSegments extends Mesh {
    constructor(g: BufferGeometry, m: Disposable) { super(g, m); made.lines.push(this as unknown as MeshLike); }
  }
  class GridHelper extends Object3D {
    geometry = new BufferGeometry();
    material = new LineBasicMaterial();
    constructor(public size: number, public divisions: number, public c1: unknown, public c2: unknown) {
      super();
      made.grids.push(this);
    }
  }
  return {
    BoxGeometry, PlaneGeometry, BufferGeometry, BufferAttribute, InstancedBufferAttribute,
    MeshBasicMaterial, LineBasicMaterial, Group, Mesh, InstancedMesh, LineSegments, GridHelper,
  };
});

import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { createSceneFrame, createScenePlan } from '@/lib/city/plan/scene-data';
import { roadVertices, windowBandMatrices } from '@/lib/city/plan/scene-geometry';
import { visibleFloors } from '@/lib/city/plan/visible-floors';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';
import { createCityMeshes } from '@/components/city/three/city-meshes';

const plan = generateCityPlan(hashString('session-meshes'));
const scene = createScenePlan(plan);
const frameFor = (built: number, lost = 0) =>
  createSceneFrame(scene, plan, visibleFloors(plan, built, 600, lost));

function at<T>(items: ReadonlyArray<T>, index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing item ${String(index)}`);
  return item;
}
const attr = (geometry: Geo, name: string): Attr => {
  const found = geometry.getAttribute(name);
  if (found === undefined) throw new Error(`missing attribute ${name}`);
  return found;
};
const colorsOf = (mesh: InstancedLike): Float32Array => {
  if (mesh.instanceColor === null) throw new Error('missing instance colors');
  return mesh.instanceColor.array;
};
const bodies = (): InstancedLike => at(made.instanced, 0);
const bands = (): InstancedLike => at(made.instanced, 1);
const edgeGeometry = (): Geo => at(made.lines, 0).geometry;
const slice = (array: Float32Array, slot: number, size: number): number[] =>
  Array.from(array.subarray(slot * size, slot * size + size));

describe('createCityMeshes (CR6.T6b)', () => {
  beforeEach(() => {
    made.instanced.length = 0;
    made.lines.length = 0;
    made.meshes.length = 0;
    made.grids.length = 0;
    made.geometries.length = 0;
    made.materials.length = 0;
  });

  it('draws the floors as two instanced meshes: bodies and window bands', () => {
    createCityMeshes({ scene, plan });
    expect(made.instanced).toHaveLength(2);
    for (const mesh of made.instanced) expect(mesh.instanceMatrix.array.length).toBe(scene.floorCount * 16);
  });

  it('fills the instances from the scene data once, in build order', () => {
    createCityMeshes({ scene, plan });
    expect(Array.from(bodies().instanceMatrix.array)).toEqual(Array.from(scene.matrices));
    expect(Array.from(bands().instanceMatrix.array)).toEqual(Array.from(windowBandMatrices(scene.matrices)));
    expect(Array.from(colorsOf(bands()))).toEqual(Array.from(scene.windowColors));
  });

  it('keeps the bodies dark so the neon edges and windows carry the color', () => {
    createCityMeshes({ scene, plan });
    const body = colorsOf(bodies());
    expect(body.length).toBe(scene.colors.length);
    for (let i = 0; i < body.length; i += 1) expect(body[i]).toBeLessThan((scene.colors[i] ?? 0) + 1e-6);
    expect(Math.max(...Array.from(body))).toBeLessThan(0.3);
  });

  it('shows nothing until a frame says how many floors are standing', () => {
    createCityMeshes({ scene, plan });
    expect(made.instanced.map((m) => m.count)).toEqual([0, 0]);
    expect(edgeGeometry().drawRange.count).toBe(0);
  });

  it('draws the edges as one line mesh over the scene data', () => {
    createCityMeshes({ scene, plan });
    expect(made.lines).toHaveLength(1);
    expect(Array.from(attr(edgeGeometry(), 'position').array)).toEqual(Array.from(scene.edges));
    expect(Array.from(attr(edgeGeometry(), 'color').array)).toEqual(Array.from(scene.edgeColors));
  });

  it('does not write into the scene data', () => {
    const before = Array.from(scene.edges);
    const meshes = createCityMeshes({ scene, plan });
    meshes.applyFrame(frameFor(301, 5));
    expect(Array.from(scene.edges)).toEqual(before);
  });

  it('adds the ground, the grid and the roads', () => {
    createCityMeshes({ scene, plan });
    expect(made.grids).toHaveLength(1);
    expect(made.meshes.some((m) => m.geometry.w === plan.bounds.width + 2)).toBe(true);
    const roads = made.meshes.find((m) => m.geometry.getAttribute('position')?.array.length === plan.roads.length * 18);
    expect(roads).toBeDefined();
    expect(Array.from(attr((roads as MeshLike).geometry, 'position').array)).toEqual(Array.from(roadVertices(plan)));
    expect(made.materials.some((m) => m.params.color === ENVIRONMENT_COLORS.floor)).toBe(true);
  });

  it('stays within the draw-call budget for the city (≤ 12)', () => {
    const meshes = createCityMeshes({ scene, plan });
    let drawables = 0;
    (meshes.group as unknown as { traverse(fn: (o: unknown) => void): void }).traverse((o) => {
      if (made.meshes.some((m) => m === o) || made.grids.includes(o as object)) drawables += 1;
    });
    expect(drawables).toBeLessThanOrEqual(12);
    expect(drawables).toBe(6);
  });

  describe('applyFrame', () => {
    it('shows as many instances as there are visible floors, and the same count of edges', () => {
      const meshes = createCityMeshes({ scene, plan });
      const frame = frameFor(450);
      meshes.applyFrame(frame);
      expect(made.instanced.map((m) => m.count)).toEqual([frame.instanceCount, frame.instanceCount]);
      expect(edgeGeometry().drawRange).toEqual({ start: 0, count: frame.edgeSegmentCount * 2 });
    });

    it('follows the floors up and down', () => {
      const meshes = createCityMeshes({ scene, plan });
      meshes.applyFrame(frameFor(450));
      meshes.applyFrame(frameFor(300));
      expect(bodies().count).toBe(frameFor(300).instanceCount);
      meshes.applyFrame(frameFor(0));
      expect(bodies().count).toBe(0);
    });

    it('does no GPU upload when the frame did not change', () => {
      const meshes = createCityMeshes({ scene, plan });
      meshes.applyFrame(frameFor(301, 0));
      const attrs = [bodies().instanceMatrix, attr(edgeGeometry(), 'position')];
      for (const a of attrs) a.needsUpdate = false;
      meshes.applyFrame(frameFor(301, 0));
      for (const a of attrs) expect(a.needsUpdate).toBe(false);
    });

    it('draws the partly paid top floor with its own scaled box and dimmer edges', () => {
      const meshes = createCityMeshes({ scene, plan });
      const frame = frameFor(301, 0);
      const partial = frame.partial;
      expect(partial).not.toBeNull();
      meshes.applyFrame(frame);
      const i = partial?.index ?? 0;
      expect(slice(bodies().instanceMatrix.array, i, 16)).toEqual(Array.from(partial?.matrix ?? []));
      expect(slice(attr(edgeGeometry(), 'position').array, i, 72)).toEqual(Array.from(partial?.edges ?? []));
      const edgeColor = slice(attr(edgeGeometry(), 'color').array, i, 72);
      expect(edgeColor[0]).toBeLessThan((scene.edgeColors[i * 72] ?? 0) + 1e-6);
    });

    it('draws a damaged top floor in the alarm red', () => {
      const meshes = createCityMeshes({ scene, plan });
      const frame = frameFor(301, 5);
      meshes.applyFrame(frame);
      const i = frame.partial?.index ?? 0;
      const [r = 0, g = 1, b = 1] = slice(attr(edgeGeometry(), 'color').array, i, 72);
      expect(r).toBeCloseTo(1, 1);
      expect(g).toBeLessThan(0.5);
      expect(b).toBeLessThan(0.5);
    });

    it('restores the floor to its full height once it is complete', () => {
      const meshes = createCityMeshes({ scene, plan });
      const frame = frameFor(301, 0);
      const i = frame.partial?.index ?? 0;
      meshes.applyFrame(frame);
      meshes.applyFrame(frameFor(600));
      expect(slice(bodies().instanceMatrix.array, i, 16)).toEqual(slice(scene.matrices, i, 16));
      expect(slice(attr(edgeGeometry(), 'position').array, i, 72)).toEqual(slice(scene.edges, i, 72));
      expect(slice(attr(edgeGeometry(), 'color').array, i, 72)).toEqual(slice(scene.edgeColors, i, 72));
    });

    it('hides the window band of a floor under construction', () => {
      const meshes = createCityMeshes({ scene, plan });
      const frame = frameFor(301, 0);
      meshes.applyFrame(frame);
      const i = frame.partial?.index ?? 0;
      expect(slice(bands().instanceMatrix.array, i, 16)[5]).toBe(0);
    });
  });

  it('frees every geometry, material and instanced mesh on dispose, once', () => {
    const meshes = createCityMeshes({ scene, plan });
    meshes.dispose();
    meshes.dispose();
    for (const g of made.geometries) expect(g.disposed).toBeGreaterThanOrEqual(1);
    for (const m of made.materials) expect(m.disposed).toBe(1);
  });
});
