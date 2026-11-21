import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import type { CityPlan, PlanProp } from '@/lib/city/plan/city-plan.types';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { FLOOR_HEIGHT } from '@/lib/city/plan/limits';

/** Width of the strip, how far it stands off the face, and the gap at its ends (world units). */
const SIGN_WIDTH = 0.24;
const SIGN_OFFSET = 0.05;
const SIGN_INSET = 0.04;
/** Thickness of a rail and of a rung: flat strips, so the sign reads at any zoom (lines are 1 px). */
const RAIL = 0.035;
const RUNG = 0.03;
/** Above 1 so the bloom pass picks the sign up as neon. */
const GLOW = 1.6;

export interface NeonSigns {
  readonly mesh: Mesh;
  /** Floors standing: a sign appears, all at once, when its building is complete. */
  show(complete: number): void;
  /** Brightness of each sign, by its index among the plan's signs (the buzz). */
  paint(levelOf: (signIndex: number) => number): void;
}

type Point = readonly [number, number, number];

/** The triangles of one sign: two rails and a rung on every floor line, flat on its face. */
function ladderOf(plan: CityPlan, sign: PlanProp): Point[] {
  const span = sign.span ?? 0;
  const bottom = sign.level * FLOOR_HEIGHT + SIGN_INSET;
  const top = (sign.level + span) * FLOOR_HEIGHT - SIGN_INSET;
  const x = sign.x - plan.bounds.width / 2;
  const z = sign.z - plan.bounds.depth / 2;
  const half = SIGN_WIDTH / 2;
  const at = (along: number, y: number): Point =>
    sign.side === 'x' ? [x + SIGN_OFFSET, y, z + along] : [x + along, y, z + SIGN_OFFSET];
  // A strip from (a0, y0) to (a1, y1) on the face, as two triangles.
  const strip = (a0: number, a1: number, y0: number, y1: number): Point[] => [
    at(a0, y0), at(a1, y0), at(a1, y1), at(a0, y0), at(a1, y1), at(a0, y1),
  ];
  const points: Point[] = [
    ...strip(-half, -half + RAIL, bottom, top),
    ...strip(half - RAIL, half, bottom, top),
  ];
  for (let rung = 0; rung <= span; rung += 1) {
    const y = bottom + ((top - bottom) * rung) / Math.max(span, 1);
    points.push(...strip(-half, half, y - RUNG / 2, y + RUNG / 2));
  }
  return points;
}

/**
 * The vertical neon signs as one mesh, in the order their buildings
 * complete, so a draw range shows exactly the finished ones. The colors are
 * rewritten when the signs buzz (whole sign at once).
 */
export function createNeonSigns(plan: CityPlan, ends: ReadonlyMap<number, number>): NeonSigns {
  const endOf = (p: PlanProp): number => ends.get(p.building ?? -1) ?? 0;
  const signs = plan.props
    .filter((p) => p.kind === 'sign')
    .map((prop, index) => ({ prop, index, points: ladderOf(plan, prop) }))
    .sort((a, b) => endOf(a.prop) - endOf(b.prop));
  const positions = new Float32Array(signs.flatMap((s) => s.points.flat()));
  const colors = new BufferAttribute(new Float32Array(positions.length), 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
  mesh.frustumCulled = false;
  const base = signs.map((s) => hexToUnitRgb(s.prop.color).map((c) => c * GLOW));

  const paint = (levelOf: (signIndex: number) => number): void => {
    let offset = 0;
    signs.forEach((sign, i) => {
      const rgb = (base[i] ?? [0, 0, 0]).map((c) => c * levelOf(sign.index));
      for (let v = 0; v < sign.points.length; v += 1) colors.array.set(rgb, (offset + v) * 3);
      offset += sign.points.length;
    });
    colors.needsUpdate = true;
  };
  const show = (complete: number): void => {
    const vertices = signs.filter((s) => complete >= endOf(s.prop)).reduce((n, s) => n + s.points.length, 0);
    geometry.setDrawRange(0, vertices);
  };
  paint(() => 1);
  return { mesh, show, paint };
}
