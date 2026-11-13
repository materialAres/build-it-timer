import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Points,
  PointsMaterial,
} from 'three';
import { beaconLevel, createAmbientPlan, flickerLevel, signLevel } from '@/lib/city/ambient-plan';
import type { CityPlan, PlanProp } from '@/lib/city/plan/city-plan.types';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { FLOOR_HEIGHT } from '@/lib/city/plan/limits';
import { AMBIENT_INTERVAL_MS } from '@/lib/city/render-scheduler';
import { createCars, createRain } from './ambient-motion';
import { createNeonSigns } from './neon-signs';

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

/**
 * Sketch D's life (CR6.T7): rain, cars, window flicker, pulsing beacons, lamps
 * and vertical neon signs, in four draw calls (lights, signs, rain, cars).
 * Lamps and signs are scenery and always drawn; the rest, the signs' buzz
 * included, is motion and stops under reduced motion. What moves comes from `lib/city/ambient-plan.ts`.
 */
export function createAmbientLayer({ plan, setWindows }: AmbientLayerInput): AmbientLayer {
  const ambient = createAmbientPlan(plan);
  const ends = completionOf(plan);
  const lights = createLights(plan, ends);
  const signs = createNeonSigns(plan, ends);
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
    signs.paint((i) => {
      const buzz = ambient.signs[i];
      return buzz === undefined ? 1 : signLevel(buzz, now);
    });
    for (const f of ambient.flickers) setWindows(f.floor, flickerLevel(f, now));
  };
  const settle = (): void => {
    lights.paint(complete, steady);
    signs.paint(steady);
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
