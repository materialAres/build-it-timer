import type { CityPlan } from './plan/city-plan.types';
import { ENVIRONMENT_COLORS } from './plan/environment-colors';
import { createRng, nextInt, shuffled } from './plan/rng';

/**
 * The seeded, pure part of the ambient layer (CR6.T7, `docs/features-analysis/city-3d.md`
 * §7): where the cars drive, which windows flicker, where the rain falls, and
 * the functions that turn a time in milliseconds into a position or a level.
 * The clock is the caller's (§1.4); the same plan always gives the same ambient.
 */

export const MAX_CARS = 12;
export const MAX_FLICKERING_FLOORS = 24;
export const RAIN_DROPS = 120;
/** Rain falls from this height to the ground, in world units. */
export const RAIN_HEIGHT = 9;
export const RAIN_STREAK = 0.35;
export const BEACON_PERIOD_MS = 1600;

const MIN_CAR_ROAD = 3;
const LANE_OFFSET = 0.2;
const FLICKER_SHARE = 0.1;
/** A window flickers once per period; long, so only a few are ever dim together (I012). */
export const FLICKER_PERIOD_MIN_MS = 10_000;
export const FLICKER_PERIOD_MAX_MS = 30_000;
/** Each of the two steps of a dip lasts this long, whatever the period. */
const FLICKER_DIP_MS = 90;
/** Keeps the ambient stream apart from the plan's own use of the seed. */
const SEED_SALT = 0x5bd1e995;

export interface CarRoute {
  /** World coordinates (x, z), lane offset included. */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly axis: 'x' | 'z';
  /** Cells per second. */
  readonly speed: number;
  /** Where on the route the car starts, 0 to 1. */
  readonly phase: number;
  readonly color: string;
}

export interface FlickerWindow {
  /** Index of the floor in build order. */
  readonly floor: number;
  readonly periodMs: number;
  readonly phaseMs: number;
}

export interface RainDrop {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
  readonly phase: number;
}

export interface AmbientPlan {
  readonly cars: ReadonlyArray<CarRoute>;
  readonly flickers: ReadonlyArray<FlickerWindow>;
  readonly rain: ReadonlyArray<RainDrop>;
}

function carsOf(plan: CityPlan, rng: ReturnType<typeof createRng>): CarRoute[] {
  const color = plan.props.find((p) => p.kind === 'lamp')?.color ?? ENVIRONMENT_COLORS.hud;
  const roads = shuffled(rng, plan.roads.filter((r) => Math.max(r.w, r.d) >= MIN_CAR_ROAD));
  const cars: CarRoute[] = [];
  for (const road of roads) {
    const horizontal = road.w >= road.d;
    const x0 = road.x - plan.bounds.width / 2;
    const z0 = road.z - plan.bounds.depth / 2;
    const count = nextInt(rng, 1, 2);
    for (let lane = 0; lane < count && cars.length < MAX_CARS; lane += 1) {
      const side = lane === 0 ? -LANE_OFFSET : LANE_OFFSET;
      const a: [number, number] = horizontal ? [x0, z0 + road.d / 2 + side] : [x0 + road.w / 2 + side, z0];
      const b: [number, number] = horizontal ? [x0 + road.w, a[1]] : [a[0], z0 + road.d];
      const forward = lane === 0;
      cars.push({
        from: forward ? a : b,
        to: forward ? b : a,
        axis: horizontal ? 'x' : 'z',
        speed: 0.6 + rng.next() * 0.8,
        phase: rng.next(),
        color,
      });
    }
  }
  return cars;
}

function flickersOf(plan: CityPlan, rng: ReturnType<typeof createRng>): FlickerWindow[] {
  const total = plan.totalFloors;
  const count = Math.min(MAX_FLICKERING_FLOORS, Math.ceil(total * FLICKER_SHARE));
  const floors = shuffled(rng, Array.from({ length: total }, (_, i) => i)).slice(0, count);
  return floors.map((floor) => {
    const periodMs = nextInt(rng, FLICKER_PERIOD_MIN_MS, FLICKER_PERIOD_MAX_MS);
    return { floor, periodMs, phaseMs: nextInt(rng, 0, periodMs - 1) };
  });
}

function rainOf(plan: CityPlan, rng: ReturnType<typeof createRng>): RainDrop[] {
  return Array.from({ length: RAIN_DROPS }, () => ({
    x: (rng.next() - 0.5) * plan.bounds.width,
    z: (rng.next() - 0.5) * plan.bounds.depth,
    speed: 5 + rng.next() * 4,
    phase: rng.next(),
  }));
}

export function createAmbientPlan(plan: CityPlan): AmbientPlan {
  const rng = createRng((plan.seed ^ SEED_SALT) >>> 0);
  return { cars: carsOf(plan, rng), flickers: flickersOf(plan, rng), rain: rainOf(plan, rng) };
}

const fraction = (value: number): number => value - Math.floor(value);

/** Where a car is at `ms`: it loops along its route. */
export function carPosition(route: CarRoute, ms: number): { x: number; z: number } {
  const length = Math.hypot(route.to[0] - route.from[0], route.to[1] - route.from[1]);
  const u = length > 0 ? fraction(route.phase + (route.speed * ms) / 1000 / length) : 0;
  return {
    x: route.from[0] + (route.to[0] - route.from[0]) * u,
    z: route.from[1] + (route.to[1] - route.from[1]) * u,
  };
}

/** Height of a drop's head at `ms`, in (0, RAIN_HEIGHT]. */
export function rainHeight(drop: RainDrop, ms: number): number {
  const travelled = fraction(drop.phase + (drop.speed * ms) / 1000 / RAIN_HEIGHT);
  return Math.max(RAIN_STREAK, RAIN_HEIGHT * (1 - travelled));
}

/** Brightness of a flickering window band: lit, with one short dip per period. */
export function flickerLevel(flicker: FlickerWindow, ms: number): number {
  const into = (((ms + flicker.phaseMs) % flicker.periodMs) + flicker.periodMs) % flicker.periodMs;
  if (into < FLICKER_DIP_MS) return 0.1;
  if (into < 2 * FLICKER_DIP_MS) return 0.6;
  return 1;
}

/** Brightness of beacon `index` at `ms`: a slow pulse, each one out of step. */
export function beaconLevel(ms: number, index: number): number {
  return 0.55 + 0.45 * Math.sin((2 * Math.PI * ms) / BEACON_PERIOD_MS + index * 1.3);
}
