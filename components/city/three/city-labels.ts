import { BufferAttribute, BufferGeometry, CanvasTexture, Mesh, MeshBasicMaterial } from 'three';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';
import type { SceneLabel } from '@/lib/city/plan/scene-data';
import { labelQuad } from '@/lib/city/plan/scene-geometry';

type Vec3 = readonly [number, number, number];

export interface CityLabels {
  readonly mesh: Mesh;
  /** Show the labels at these indexes (landmarks that are complete); the others are hidden. */
  show(indices: ReadonlyArray<number>): void;
  /** Turn every label to face a camera with these right and up axes. */
  orient(right: Vec3, up: Vec3): void;
  dispose(): void;
}

const ROW_PX = 40;
const ATLAS_PX = 360;
const FONT = `bold 22px ui-monospace, 'Courier New', monospace`;
/** World height of a label; its width follows the text. */
const LABEL_HEIGHT = 0.3;

interface Row {
  readonly widthPx: number;
}

function drawAtlas(context: CanvasRenderingContext2D, labels: ReadonlyArray<SceneLabel>): Row[] {
  context.font = FONT;
  context.fillStyle = ENVIRONMENT_COLORS.hud;
  context.textBaseline = 'middle';
  return labels.map((label, index) => {
    const text = `> ${label.name}`;
    context.fillText(text, 4, index * ROW_PX + ROW_PX / 2);
    return { widthPx: Math.min(ATLAS_PX, context.measureText(text).width + 8) };
  });
}

function uvs(rows: ReadonlyArray<Row>): Float32Array {
  const out = new Float32Array(rows.length * 8);
  rows.forEach((row, i) => {
    const u = row.widthPx / ATLAS_PX;
    const [top, bottom] = [1 - i / rows.length, 1 - (i + 1) / rows.length];
    out.set([0, bottom, u, bottom, u, top, 0, top], i * 8);
  });
  return out;
}

interface LabelParts {
  readonly mesh: Mesh;
  readonly geometry: BufferGeometry;
  readonly positions: BufferAttribute;
  readonly index: BufferAttribute;
  readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
}

/** One mesh of quads (4 vertices each) over the atlas; the index buffer says which are drawn. */
function labelParts(canvas: HTMLCanvasElement, rows: ReadonlyArray<Row>): LabelParts {
  const geometry = new BufferGeometry();
  const positions = new BufferAttribute(new Float32Array(rows.length * 12), 3);
  const index = new BufferAttribute(new Uint16Array(rows.length * 6), 1);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', new BufferAttribute(uvs(rows), 2));
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);
  const texture = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return { mesh, geometry, positions, index, texture, material };
}

/**
 * The `> NAME` tags of the landmark towers (CR6.T7): every name is drawn once
 * into one canvas texture and the labels are quads of a single mesh, so they
 * cost one draw call. Returns null where there is nothing to show or no 2D
 * canvas (the city then simply has no tags).
 */
export function createCityLabels(labels: ReadonlyArray<SceneLabel>): CityLabels | null {
  if (labels.length === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ROW_PX * labels.length;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  const rows = drawAtlas(context, labels);
  const { mesh, geometry, positions, index, texture, material } = labelParts(canvas, rows);

  return {
    mesh,
    show(indices): void {
      index.array.fill(0);
      indices.forEach((label, i) => {
        index.array.set([label * 4, label * 4 + 1, label * 4 + 2, label * 4, label * 4 + 2, label * 4 + 3], i * 6);
      });
      geometry.setDrawRange(0, indices.length * 6);
      index.needsUpdate = true;
    },
    orient(right, up): void {
      labels.forEach((label, i) => {
        const width = (LABEL_HEIGHT * (rows[i]?.widthPx ?? ATLAS_PX)) / ROW_PX;
        positions.array.set(labelQuad(label.position, width, LABEL_HEIGHT, right, up), i * 12);
      });
      positions.needsUpdate = true;
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
