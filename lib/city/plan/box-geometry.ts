/** An axis-aligned box: center and full size, in world units. */
export interface Box {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

export const EDGES_PER_BOX = 12;

/** Column-major 4×4 matrix: scale by the box size, then move to its center. */
export function boxMatrix(box: Box): number[] {
  return [box.sx, 0, 0, 0, 0, box.sy, 0, 0, 0, 0, box.sz, 0, box.cx, box.cy, box.cz, 1];
}

/** The 12 edges of a box as 72 floats: x1 y1 z1 x2 y2 z2 per segment. */
export function boxEdges(box: Box): number[] {
  const [x0, x1] = [box.cx - box.sx / 2, box.cx + box.sx / 2];
  const [y0, y1] = [box.cy - box.sy / 2, box.cy + box.sy / 2];
  const [z0, z1] = [box.cz - box.sz / 2, box.cz + box.sz / 2];
  // Corners 0..3 walk around the base: (x0,z0) (x1,z0) (x1,z1) (x0,z1).
  const corner = (i: number, top: boolean): number[] => [
    i === 1 || i === 2 ? x1 : x0,
    top ? y1 : y0,
    i >= 2 ? z1 : z0,
  ];
  const segments: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const next = (i + 1) % 4;
    segments.push(...corner(i, false), ...corner(next, false)); // bottom ring
    segments.push(...corner(i, true), ...corner(next, true)); // top ring
    segments.push(...corner(i, false), ...corner(i, true)); // vertical
  }
  return segments;
}
