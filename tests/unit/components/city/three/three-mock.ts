/**
 * A small typed stand-in for the parts of three.js the city modules use, shared
 * by the CR6.T7 tests (happy-dom has no WebGL). `made` records what was built.
 */
export interface Attr {
  array: Float32Array | Uint16Array;
  itemSize: number;
  needsUpdate: boolean;
}
export interface Geo {
  disposed: number;
  index: Attr | null;
  drawRange: { start: number; count: number };
  getAttribute(name: string): Attr | undefined;
}
export interface Mat {
  params: Record<string, unknown>;
  disposed: number;
}
export interface Obj {
  kind: string;
  visible: boolean;
  renderOrder: number;
  children: Obj[];
  geometry?: Geo;
  material?: Mat;
  count?: number;
  instanceMatrix?: Attr;
  instanceColor?: Attr | null;
  traverse(fn: (o: Obj) => void): void;
}
export interface Made {
  objects: Obj[];
  textures: Array<{ disposed: number }>;
}

export const made: Made = { objects: [], textures: [] };

export const resetMade = (): void => {
  made.objects.length = 0;
  made.textures.length = 0;
};

export const ofKind = (kind: string): Obj[] => made.objects.filter((o) => o.kind === kind);

export function only(kind: string): Obj {
  const found = ofKind(kind);
  if (found.length !== 1 || found[0] === undefined) throw new Error(`expected one ${kind}, got ${String(found.length)}`);
  return found[0];
}

export function attr(geometry: Geo | undefined, name: string): Attr {
  const found = geometry?.getAttribute(name);
  if (found === undefined) throw new Error(`missing attribute ${name}`);
  return found;
}

export function threeMock(): Record<string, unknown> {
  class Disposable {
    disposed = 0;
    dispose(): void { this.disposed += 1; }
  }
  class BufferAttribute {
    needsUpdate = false;
    constructor(public array: Float32Array | Uint16Array, public itemSize: number) {}
  }
  class InstancedBufferAttribute extends BufferAttribute {}
  class BufferGeometry extends Disposable {
    attrs: Record<string, BufferAttribute> = {};
    index: BufferAttribute | null = null;
    drawRange = { start: 0, count: Infinity };
    setAttribute(name: string, a: BufferAttribute): this { this.attrs[name] = a; return this; }
    getAttribute(name: string): BufferAttribute | undefined { return this.attrs[name]; }
    setIndex(a: BufferAttribute): this { this.index = a; return this; }
    setDrawRange(start: number, count: number): void { this.drawRange = { start, count }; }
  }
  class BoxGeometry extends BufferGeometry {}
  class PlaneGeometry extends BufferGeometry {}
  class Material extends Disposable {
    constructor(public params: Record<string, unknown> = {}) { super(); }
  }
  class Object3D {
    visible = true;
    renderOrder = 0;
    children: Obj[] = [];
    rotation = { x: 0 };
    position = { x: 0, y: 0, z: 0 };
    frustumCulled = true;
    constructor(public kind: string) { made.objects.push(this); }
    add(...c: Obj[]): this { this.children.push(...c); return this; }
    traverse(fn: (o: Obj) => void): void {
      fn(this);
      for (const c of this.children) c.traverse(fn);
    }
  }
  class Group extends Object3D {
    constructor() { super('group'); }
  }
  class Mesh extends Object3D {
    constructor(public geometry: BufferGeometry, public material: Material, kind = 'mesh') { super(kind); }
  }
  class InstancedMesh extends Mesh {
    count: number;
    instanceMatrix: BufferAttribute;
    instanceColor: BufferAttribute | null = null;
    constructor(g: BufferGeometry, m: Material, count: number) {
      super(g, m, 'instanced');
      this.count = count;
      this.instanceMatrix = new BufferAttribute(new Float32Array(count * 16), 16);
    }
    dispose(): void { this.geometry.dispose(); }
  }
  class LineSegments extends Mesh {
    constructor(g: BufferGeometry, m: Material) { super(g, m, 'lines'); }
  }
  class Points extends Mesh {
    constructor(g: BufferGeometry, m: Material) { super(g, m, 'points'); }
  }
  class GridHelper extends Object3D {
    geometry = new BufferGeometry();
    material = new Material();
    constructor() { super('grid'); }
  }
  class CanvasTexture extends Disposable {
    constructor(public canvas: unknown) { super(); made.textures.push(this); }
  }
  return {
    BufferAttribute, InstancedBufferAttribute, BufferGeometry, BoxGeometry, PlaneGeometry,
    MeshBasicMaterial: Material, LineBasicMaterial: Material, PointsMaterial: Material,
    Group, Mesh, InstancedMesh, LineSegments, Points, GridHelper, CanvasTexture,
    DoubleSide: 2,
  };
}
