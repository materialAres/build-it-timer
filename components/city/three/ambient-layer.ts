import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
} from 'three';
import { beaconLevel, createAmbientPlan, flickerLevel } from '@/lib/city/ambient-plan';
import type { CityPlan, PlanProp } from '@/lib/city/plan/city-plan.types';
import { boxMatrix } from '@/lib/city/plan/box-geometry';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { FLOOR_HEIGHT } from '@/lib/city/plan/limits';
import { AMBIENT_INTERVAL_MS } from '@/lib/city/render-scheduler';
import { createCars, createRain } from './ambient-motion';

export interface AmbientLayerInput {
  readonly plan: CityPlan;
  /** Brightness of a floor's window band (the flicker), from `floor-slots.ts`. */
  readonly setWindows: (slot: number, level: number) => void;
}

export interface AmbientLayer {
  readonly group: Group;
  /** Floors standing: props of a building appear once it is complete. */
  setComplete(floors: number): void;
  /** Advance the motion to `now`; returns false when it was not yet due (30 fps cap). */
  update(now: number): boolean;
  /** Rain, cars, flicker and the beacon pulse on or off; off leaves the scenery steady. */
  setMotion(enabled: boolean): void;
  dispose(): void;
}

const LAMP_HEIGHT = 0.5;
const SIGN_SIZE = [0.5, 0.18, 0.04] as const;

const worldOf = (plan: CityPlan, prop: PlanProp): [number, number, number] => [
  prop.x - plan.bounds.width / 2,
  prop.level * FLOOR_HEIGHT + (prop.kind === 'lamp' ? LAMP_HEIGHT : 0.2),
  prop.z - plan.bounds.depth / 2,
];

/** Index in build order just past a building's last floor: when its props appear. */
function completionOf(plan: CityPlan): Map<number, number> {
  const end = new Map<number, number>();
  plan.floors.forEach((floor, index) => end.set(floor.building, index + 1));
  return end;
}

/** Static lights (lamps first, then beacons) as one `Points`; beacon colors are rewritten as they pulse. */
function createLights(plan: CityPlan, ends: Map<number, number>) {
  const lights = plan.props.filter((p) => p.kind !== 'sign').sort((a, b) => Number(a.kind === 'beacon') - Number(b.kind === 'beacon'));
  const positions = new Float32Array(lights.flatMap((p) => worldOf(plan, p)));
  const colors = new BufferAttribute(new Float32Array(lights.length * 3), 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', colors);
  const points = new Points(geometry, new PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true }));
  points.frustumCulled = false;
  const base = lights.map((p) => hexToUnitRgb(p.color));
  const beacons = lights.flatMap((p, index) => (p.kind === 'beacon' ? [index] : []));
  const paint = (complete: number, pulse: (beaconIndex: number) => number): void => {
    lights.forEach((prop, index) => {
      const done = prop.building === null || complete >= (ends.get(prop.building) ?? 0);
      const level = done ? (prop.kind === 'beacon' ? pulse(beacons.indexOf(index)) : 1) : 0;
      colors.array.set((base[index] ?? [0, 0, 0]).map((c) => c * level), index * 3);
    });
    colors.needsUpdate = true;
  };
  return { points, paint };
}

/** Signs as instanced boxes sorted by when their building completes, so a count shows the right ones. */
function createSigns(plan: CityPlan, ends: Map<number, number>) {
  const signs = plan.props
    .filter((p) => p.kind === 'sign')
    .sort((a, b) => (ends.get(a.building ?? -1) ?? 0) - (ends.get(b.building ?? -1) ?? 0));
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff }), Math.max(signs.length, 1));
  const colors = new Float32Array(Math.max(signs.length, 1) * 3);
  signs.forEach((sign, index) => {
    const [x, y, z] = worldOf(plan, sign);
    mesh.instanceMatrix.array.set(boxMatrix({ cx: x, cy: y, cz: z, sx: SIGN_SIZE[0], sy: SIGN_SIZE[1], sz: SIGN_SIZE[2] }), index * 16);
    colors.set(hexToUnitRgb(sign.color), index * 3);
  });
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const show = (complete: number): void => {
    mesh.count = signs.filter((s) => complete >= (ends.get(s.building ?? -1) ?? 0)).length;
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { mesh, show };
}

/**
 * Sketch D's life (CR6.T7): rain, cars, window flicker, pulsing beacons, lamps
 * and signs, in four draw calls (lights, signs, rain, cars). Lamps and signs
 * are scenery and always drawn; the rest is motion and stops under reduced
 * motion. What moves comes from `lib/city/ambient-plan.ts`.
 */
export function createAmbientLayer({ plan, setWindows }: AmbientLayerInput): AmbientLayer {
  const ambient = createAmbientPlan(plan);
  const ends = completionOf(plan);
  const lights = createLights(plan, ends);
  const signs = createSigns(plan, ends);
  const rainLayer = createRain(ambient);
  const cars = createCars(ambient);
  const group = new Group();
  group.add(lights.points, signs.mesh, rainLayer.lines, cars.mesh);

  let complete = 0;
  let motion = true;
  let lastAt: number | null = null;
  const steady = (): number => 1;
  const render = (now: number): void => {
    rainLayer.step(now);
    cars.step(now);
    lights.paint(complete, (i) => beaconLevel(now, i));
    for (const f of ambient.flickers) setWindows(f.floor, flickerLevel(f, now));
  };
  const settle = (): void => {
    lights.paint(complete, steady);
    for (const f of ambient.flickers) setWindows(f.floor, 1);
  };
  render(0);

  return {
    group,
    setComplete(floors): void {
      complete = floors;
      signs.show(floors);
      if (!motion) settle();
    },
    update(now): boolean {
      if (!motion) return false;
      if (lastAt !== null && now - lastAt < AMBIENT_INTERVAL_MS) return false;
      lastAt = now;
      render(now);
      return true;
    },
    setMotion(enabled): void {
      motion = enabled;
      rainLayer.lines.visible = enabled;
      cars.mesh.visible = enabled;
      lastAt = null;
      if (!enabled) settle();
    },
    dispose(): void {
      group.traverse((object) => {
        const { geometry, material } = object as { geometry?: { dispose(): void }; material?: { dispose(): void } };
        geometry?.dispose();
        material?.dispose();
      });
    },
  };
}
