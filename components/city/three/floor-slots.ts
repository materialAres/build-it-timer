import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
} from 'three';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { DAMAGED_EDGE_COLOR } from '@/lib/city/plan/environment-colors';
import { EDGES_PER_FLOOR, type PartialFloor, type ScenePlan } from '@/lib/city/plan/scene-data';
import { scaleColors, windowBandMatrices } from '@/lib/city/plan/scene-geometry';

/** Bodies stay dark so the neon edges and windows carry the color (sketch D); a floor under construction is half as bright again. */
const BODY_DIM = 0.12;
const PARTIAL_DIM = 0.5;
const FLOATS_PER_EDGE_SLOT = EDGES_PER_FLOOR * 6;
const NO_SHIFT = [0, 0, 0] as const;

export interface FloorMeshes {
  readonly bodies: InstancedMesh;
  readonly bands: InstancedMesh;
  readonly bandMatrices: Float32Array;
  readonly bodyColors: Float32Array;
}

export interface EdgeLines {
  readonly edges: LineSegments;
  readonly geometry: BufferGeometry;
  readonly positions: BufferAttribute;
  readonly colors: BufferAttribute;
}

/** How a floor slot is drawn: its resting data, or the partly paid floor, shifted, glitching or dimmed. */
export interface SlotLook {
  readonly partial?: PartialFloor | undefined;
  /** World-unit offset of the whole floor (a drop, a shake). */
  readonly shift?: readonly [number, number, number];
  /** Set while the floor glitches out: its red intensity, 0 being a blink-out. */
  readonly glitch?: number;
  /** Multiplier on the edge brightness (the damaged floor's flicker). */
  readonly glow?: number;
}

export interface SlotWriter {
  /** Write one floor slot from the static data (no look) or from a look. */
  draw(slot: number, look?: SlotLook): void;
  /** Brightness of a floor's window band, for the flicker; 1 is the resting color. */
  setWindows(slot: number, level: number): void;
}

function instanced(geometry: BoxGeometry, matrices: Float32Array, colors: Float32Array, count: number): InstancedMesh {
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ color: 0xffffff }), count);
  mesh.instanceMatrix.array.set(matrices);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

export function floorMeshes(scene: ScenePlan): FloorMeshes {
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

/** One line mesh over copies of the scene's edge arrays, so the scene data is never written. */
export function edgeLines(scene: ScenePlan): EdgeLines {
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

type Shift = readonly [number, number, number];

/** A 4 × 4 matrix with its translation moved by `shift`. */
function shiftedMatrix(source: ArrayLike<number>, shift: Shift): Float32Array {
  const out = Float32Array.from(source);
  out[12] = (out[12] ?? 0) + shift[0];
  out[13] = (out[13] ?? 0) + shift[1];
  out[14] = (out[14] ?? 0) + shift[2];
  return out;
}

/** A floor under construction or glitching has no lit windows yet: a zero-height band at the same spot. */
function hiddenBand(matrix: Float32Array): Float32Array {
  const [tx = 0, ty = 0, tz = 0] = matrix.subarray(12, 15);
  return new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, tx, ty, tz, 1]);
}

function shiftedEdges(source: ArrayLike<number>, shift: Shift): Float32Array {
  const out = Float32Array.from(source);
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) + (shift[i % 3] ?? 0);
  return out;
}

/** Edge colors of a slot: its resting color, dimmed, red or flickering, per its look. */
function edgePaint(resting: Float32Array, look: SlotLook): Float32Array {
  const red = hexToUnitRgb(DAMAGED_EDGE_COLOR);
  const glow = look.glow ?? 1;
  return resting.map((channel, i) => {
    if (look.glitch !== undefined) return (red[i % 3] ?? 0) * look.glitch;
    if (look.partial === undefined) return channel * glow;
    return (look.partial.damaged ? (red[i % 3] ?? 0) : channel * PARTIAL_DIM) * glow;
  });
}

/** Writes one floor slot back to its full-height data, or over it per a look. */
export function slotWriter(scene: ScenePlan, floors: FloorMeshes, lines: EdgeLines): SlotWriter {
  const { bodies, bands, bandMatrices, bodyColors } = floors;
  const red = hexToUnitRgb(DAMAGED_EDGE_COLOR);
  const edgeFrom = (slot: number): number => slot * FLOATS_PER_EDGE_SLOT;
  return {
    draw(slot, look = {}): void {
      const shift = look.shift ?? NO_SHIFT;
      const hidden = look.partial !== undefined || look.glitch !== undefined;
      const body = shiftedMatrix(look.partial?.matrix ?? scene.matrices.subarray(slot * 16, slot * 16 + 16), shift);
      bodies.instanceMatrix.array.set(body, slot * 16);
      bands.instanceMatrix.array.set(
        hidden ? hiddenBand(body) : shiftedMatrix(bandMatrices.subarray(slot * 16, slot * 16 + 16), shift),
        slot * 16,
      );
      const dim = look.partial === undefined ? 1 : PARTIAL_DIM;
      const paint =
        look.glitch === undefined
          ? bodyColors.subarray(slot * 3, slot * 3 + 3).map((c) => c * dim)
          : red.map((c) => c * BODY_DIM * (look.glitch ?? 0));
      bodies.instanceColor?.array.set(paint, slot * 3);
      const [from, to] = [edgeFrom(slot), edgeFrom(slot + 1)];
      lines.positions.array.set(shiftedEdges(look.partial?.edges ?? scene.edges.subarray(from, to), shift), from);
      lines.colors.array.set(edgePaint(scene.edgeColors.subarray(from, to), look), from);
    },
    setWindows(slot, level): void {
      const colors = bands.instanceColor;
      if (!colors) return;
      colors.array.set(scene.windowColors.subarray(slot * 3, slot * 3 + 3).map((c) => c * level), slot * 3);
      colors.needsUpdate = true;
    },
  };
}
