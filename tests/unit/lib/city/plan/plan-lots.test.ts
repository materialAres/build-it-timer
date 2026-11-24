import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { ROAD_LAYOUTS } from '@/lib/city/plan/road-layouts';
import {
  GROUND_DEPTH,
  GROUND_WIDTH,
  MAX_LOTS,
  MIN_LOTS,
} from '@/lib/city/plan/limits';
import type { GroundPlan } from '@/lib/city/plan/city-plan.types';

const seedOf = (index: number): number => hashString(`session-${String(index)}`);
const plans = (count: number): GroundPlan[] =>
  Array.from({ length: count }, (_, index) => generateCityPlan(seedOf(index)));

const key = (x: number, z: number): string => `${String(x)},${String(z)}`;

/** Every cell a road occupies. */
function roadCells(plan: GroundPlan): Set<string> {
  const cells = new Set<string>();
  for (const road of plan.roads) {
    for (let x = road.x; x < road.x + road.w; x += 1) {
      for (let z = road.z; z < road.z + road.d; z += 1) cells.add(key(x, z));
    }
  }
  return cells;
}

function isConnected(cells: ReadonlySet<string>): boolean {
  const first = [...cells][0];
  if (first === undefined) return false;
  const seen = new Set([first]);
  const queue = [first];
  while (queue.length > 0) {
    const [x, z] = (queue.pop() ?? '0,0').split(',').map(Number) as [number, number];
    for (const next of [key(x + 1, z), key(x - 1, z), key(x, z + 1), key(x, z - 1)]) {
      if (cells.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === cells.size;
}

describe('generateCityPlan — ground plan (CR6.T2a)', () => {
  it('is deterministic: the same seed gives a deep-equal plan', () => {
    expect(generateCityPlan(seedOf(5))).toEqual(generateCityPlan(seedOf(5)));
  });

  it('carries its seed and the fixed frame', () => {
    const plan = generateCityPlan(123);
    expect(plan.seed).toBe(123);
    expect(plan.bounds).toEqual({ width: GROUND_WIDTH, depth: GROUND_DEPTH });
  });

  it('does not read Math.random (the PRNG comes from the seed)', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random must not be called');
    };
    try {
      expect(() => generateCityPlan(1)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  describe('invariants over 1,000 seeds', { timeout: 20_000 }, () => {
    const all = plans(1000);

    it('keeps every road and lot inside the frame', () => {
      for (const plan of all) {
        for (const r of [...plan.roads, ...plan.lots]) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.z).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(GROUND_WIDTH);
          expect(r.z + r.d).toBeLessThanOrEqual(GROUND_DEPTH);
        }
      }
    });

    it('puts no lot on a road and no lot on another lot', () => {
      for (const plan of all) {
        const taken = roadCells(plan);
        for (const lot of plan.lots) {
          for (let x = lot.x; x < lot.x + lot.w; x += 1) {
            for (let z = lot.z; z < lot.z + lot.d; z += 1) {
              expect(taken.has(key(x, z))).toBe(false);
              taken.add(key(x, z));
            }
          }
        }
      }
    });

    it('tiles the whole ground: every cell is a road or in exactly one lot', () => {
      for (const plan of all) {
        const area = plan.lots.reduce((sum, lot) => sum + lot.w * lot.d, 0);
        expect(area + roadCells(plan).size).toBe(GROUND_WIDTH * GROUND_DEPTH);
      }
    });

    it('connects every road into one network', () => {
      for (const plan of all) expect(isConnected(roadCells(plan))).toBe(true);
    });

    it('stays within the lot-count bounds', () => {
      for (const plan of all) {
        expect(plan.lots.length).toBeGreaterThanOrEqual(MIN_LOTS);
        expect(plan.lots.length).toBeLessThanOrEqual(MAX_LOTS);
      }
    });

    it('numbers the lots 0..n-1 in order', () => {
      for (const plan of all) {
        expect(plan.lots.map((lot) => lot.id)).toEqual(
          plan.lots.map((_, index) => index),
        );
      }
    });
  });

  describe('variation over 100 seeds', () => {
    const hundred = plans(100);
    const distinct = (values: ReadonlyArray<unknown>): number =>
      new Set(values.map((value) => JSON.stringify(value))).size;

    it('uses several road layouts', () => {
      expect(distinct(hundred.map((plan) => plan.layoutId))).toBeGreaterThanOrEqual(3);
    });

    it('moves the roads by several different offsets', () => {
      expect(distinct(hundred.map((plan) => plan.offset))).toBeGreaterThanOrEqual(5);
    });

    it('mixes the lot footprints differently from seed to seed', () => {
      const mix = hundred.map((plan) =>
        plan.lots.filter((lot) => lot.w * lot.d === 4).length,
      );
      expect(distinct(mix)).toBeGreaterThanOrEqual(4);
      const kinds = new Set(hundred.flatMap((plan) => plan.lots.map((l) => `${String(l.w)}x${String(l.d)}`)));
      expect([...kinds].sort()).toEqual(['1x1', '1x2', '2x1', '2x2']);
    });

    it('gives almost every session its own plan', () => {
      expect(distinct(hundred)).toBeGreaterThanOrEqual(95);
    });
  });

  describe('data-driven (Open/Closed)', () => {
    it('draws from the layouts it is given, with no generator change', () => {
      const solo = {
        id: 'solo',
        maxOffset: 0,
        roads: [{ axis: 'x', at: 4, from: 0, to: GROUND_WIDTH - 1 }],
      } as const;
      const plan = generateCityPlan(seedOf(1), { layouts: [solo] });
      expect(plan.layoutId).toBe('solo');
      expect(plan.offset).toEqual({ x: 0, z: 0 });
      expect(plan.roads).toEqual([{ x: 0, z: 4, w: GROUND_WIDTH, d: 1 }]);
    });

    it('ships at least four layouts with unique ids', () => {
      expect(ROAD_LAYOUTS.length).toBeGreaterThanOrEqual(4);
      expect(new Set(ROAD_LAYOUTS.map((layout) => layout.id)).size).toBe(
        ROAD_LAYOUTS.length,
      );
    });
  });
});
