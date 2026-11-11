import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import {
  BEACON_PERIOD_MS,
  MAX_CARS,
  MAX_FLICKERING_FLOORS,
  RAIN_DROPS,
  RAIN_HEIGHT,
  beaconLevel,
  carPosition,
  createAmbientPlan,
  flickerLevel,
  rainHeight,
} from '@/lib/city/ambient-plan';

const seeds = Array.from({ length: 40 }, (_, i) => hashString(`ambient-${String(i)}`));

describe('createAmbientPlan (CR6.T7)', () => {
  it('is deterministic: the same plan gives the same ambient', () => {
    const plan = generateCityPlan(seeds[0] ?? 0);
    expect(createAmbientPlan(plan)).toEqual(createAmbientPlan(plan));
  });

  it('differs between sessions', () => {
    const a = createAmbientPlan(generateCityPlan(seeds[0] ?? 0));
    const b = createAmbientPlan(generateCityPlan(seeds[1] ?? 0));
    expect(a.rain).not.toEqual(b.rain);
  });

  it('keeps every count under its cap and always has some cars', () => {
    const offenders = seeds.filter((seed) => {
      const ambient = createAmbientPlan(generateCityPlan(seed));
      return (
        ambient.cars.length < 1 ||
        ambient.cars.length > MAX_CARS ||
        ambient.flickers.length > MAX_FLICKERING_FLOORS ||
        ambient.rain.length !== RAIN_DROPS
      );
    });
    expect(offenders).toEqual([]);
  });

  it('puts every car on a road: its route stays inside the ground', () => {
    const offenders = seeds.filter((seed) => {
      const plan = generateCityPlan(seed);
      const { width, depth } = plan.bounds;
      return createAmbientPlan(plan).cars.some((car) =>
        [car.from, car.to].some(([x, z]) => Math.abs(x) > width / 2 + 0.01 || Math.abs(z) > depth / 2 + 0.01),
      );
    });
    expect(offenders).toEqual([]);
  });

  it('flickers only floors of the plan, each once', () => {
    const plan = generateCityPlan(seeds[2] ?? 0);
    const floors = createAmbientPlan(plan).flickers.map((f) => f.floor);
    expect(new Set(floors).size).toBe(floors.length);
    expect(floors.every((f) => f >= 0 && f < plan.totalFloors)).toBe(true);
  });
});

describe('ambient time functions (CR6.T7)', () => {
  const plan = generateCityPlan(seeds[3] ?? 0);
  const ambient = createAmbientPlan(plan);
  const car = ambient.cars[0];
  if (car === undefined) throw new Error('no car');

  it('moves a car along its route and loops', () => {
    const start = carPosition(car, 0);
    const later = carPosition(car, 500);
    expect(later).not.toEqual(start);
    const length = Math.hypot(car.to[0] - car.from[0], car.to[1] - car.from[1]);
    const lap = (length / car.speed) * 1000;
    const again = carPosition(car, lap);
    expect(again.x).toBeCloseTo(start.x, 6);
    expect(again.z).toBeCloseTo(start.z, 6);
  });

  it('keeps a car on its own lane axis', () => {
    const a = carPosition(car, 0);
    const b = carPosition(car, 3000);
    if (car.axis === 'x') expect(a.z).toBeCloseTo(b.z, 9);
    else expect(a.x).toBeCloseTo(b.x, 9);
  });

  it('keeps rain between the ground and the sky, falling down', () => {
    const drop = ambient.rain[0];
    if (drop === undefined) throw new Error('no drop');
    const heights = [0, 100, 250, 1000, 7000].map((ms) => rainHeight(drop, ms));
    for (const h of heights) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(RAIN_HEIGHT);
    }
    expect(rainHeight(drop, 100)).toBeLessThan(rainHeight(drop, 0) + 1e-9);
  });

  it('flickers a window: mostly lit, with dips', () => {
    const flicker = { floor: 1, periodMs: 2000, phaseMs: 0 };
    const levels = Array.from({ length: 200 }, (_, i) => flickerLevel(flicker, i * 10));
    expect(Math.max(...levels)).toBe(1);
    expect(Math.min(...levels)).toBeLessThan(0.5);
    expect(levels.filter((l) => l === 1).length).toBeGreaterThan(150);
  });

  it('pulses a beacon between dim and bright, each out of step', () => {
    const levels = Array.from({ length: 64 }, (_, i) => beaconLevel((i * BEACON_PERIOD_MS) / 64, 0));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1 + 1e-9);
    expect(beaconLevel(0, 0)).not.toBeCloseTo(beaconLevel(0, 1), 3);
  });
});
