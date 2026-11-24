import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { ARCHETYPES } from '@/lib/city/plan/building-archetypes';
import {
  GROUND_DEPTH,
  GROUND_WIDTH,
  MAX_BEACONS,
  MAX_BUILDING_FLOORS,
  MAX_LAMPS,
  MAX_LANDMARKS,
  MAX_PARK_SHARE,
  MAX_SIGNS,
  MAX_TOTAL_FLOORS,
  MIN_LANDMARKS,
  MIN_TOTAL_FLOORS,
} from '@/lib/city/plan/limits';
import type { Archetype, CityPlan } from '@/lib/city/plan/city-plan.types';

const seedOf = (index: number): number => hashString(`session-${String(index)}`);
const plans = (count: number): CityPlan[] =>
  Array.from({ length: count }, (_, index) => generateCityPlan(seedOf(index)));
const archetypeById = (id: string): Archetype => {
  const found = ARCHETYPES.find((a) => a.id === id);
  if (found === undefined) throw new Error(`unknown archetype ${id}`);
  return found;
};
const distinct = (values: ReadonlyArray<unknown>): number =>
  new Set(values.map((value) => JSON.stringify(value))).size;

describe('generateCityPlan — buildings (CR6.T2b)', () => {
  it('is deterministic: the same seed gives a deep-equal plan', () => {
    expect(generateCityPlan(seedOf(8))).toEqual(generateCityPlan(seedOf(8)));
  });

  it('does not read Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random must not be called');
    };
    try {
      expect(() => generateCityPlan(2)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  describe('invariants over 1,000 seeds', { timeout: 20_000 }, () => {
    const all = plans(1000);

    it('keeps the total floors inside the bounds and equal to the list', () => {
      for (const plan of all) {
        expect(plan.totalFloors).toBe(plan.floors.length);
        expect(plan.totalFloors).toBeGreaterThanOrEqual(MIN_TOTAL_FLOORS);
        expect(plan.totalFloors).toBeLessThanOrEqual(MAX_TOTAL_FLOORS);
      }
    });

    it('puts at most one building on a lot, never on a road', () => {
      for (const plan of all) {
        const lotIds = plan.buildings.map((b) => b.lotId);
        expect(new Set(lotIds).size).toBe(lotIds.length);
        for (const id of lotIds) expect(plan.lots[id]).toBeDefined();
        expect(plan.buildings.map((b) => b.id)).toEqual(plan.buildings.map((_, i) => i));
      }
    });

    it('leaves at most the park share of the lots empty', () => {
      for (const plan of all) {
        const parks = plan.lots.length - plan.buildings.length;
        expect(parks).toBeGreaterThanOrEqual(0);
        expect(parks).toBeLessThanOrEqual(Math.floor(plan.lots.length * MAX_PARK_SHARE));
      }
    });

    it('keeps every height inside its archetype range and the frame', () => {
      for (const plan of all) {
        for (const b of plan.buildings) {
          const range = archetypeById(b.archetypeId);
          const bounds = b.landmark ? range.landmarkFloors : range.floors;
          expect(bounds).toBeDefined();
          expect(b.height).toBeGreaterThanOrEqual(bounds?.min ?? Infinity);
          expect(b.height).toBeLessThanOrEqual(bounds?.max ?? 0);
          expect(b.height).toBeLessThanOrEqual(MAX_BUILDING_FLOORS);
        }
      }
    });

    it('keeps every section inside its lot and the ground', () => {
      const eps = 1e-9;
      const offenders: string[] = [];
      for (const plan of all) {
        for (const b of plan.buildings) {
          const lot = plan.lots[b.lotId];
          if (lot === undefined) {
            offenders.push('no lot');
            continue;
          }
          for (const { rect: r } of b.sections) {
            const inside =
              r.w > 0 &&
              r.d > 0 &&
              r.x >= lot.x &&
              r.z >= lot.z &&
              r.x + r.w <= lot.x + lot.w + eps &&
              r.z + r.d <= lot.z + lot.d + eps &&
              r.x + r.w <= GROUND_WIDTH &&
              r.z + r.d <= GROUND_DEPTH;
            if (!inside) offenders.push(`${String(plan.seed)}:${String(b.id)}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it('has between 1 and 3 landmarks, each named once; others are unnamed', () => {
      for (const plan of all) {
        const landmarks = plan.buildings.filter((b) => b.landmark);
        expect(landmarks.length).toBeGreaterThanOrEqual(MIN_LANDMARKS);
        expect(landmarks.length).toBeLessThanOrEqual(MAX_LANDMARKS);
        const names = landmarks.map((b) => b.name);
        expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
        expect(new Set(names).size).toBe(names.length);
        for (const b of plan.buildings.filter((x) => !x.landmark)) expect(b.name).toBeNull();
      }
    });

    it('lists every floor exactly once and never before the one below', () => {
      for (const plan of all) {
        const expected = plan.buildings.flatMap((b) =>
          b.sections.flatMap((s, section) =>
            Array.from({ length: s.toLevel - s.fromLevel }, (_, i) =>
              `${String(b.id)}:${String(s.fromLevel + i)}:${String(section)}`,
            ),
          ),
        );
        const listed = plan.floors.map((f) => `${String(f.building)}:${String(f.level)}:${String(f.section)}`);
        expect([...listed].sort()).toEqual([...expected].sort());

        const top = new Map<number, number>();
        for (const f of plan.floors) {
          expect(f.level).toBeGreaterThanOrEqual(top.get(f.building) ?? 0);
          top.set(f.building, f.level);
        }
      }
    });

    it('builds one building at a time, bottom-up', () => {
      for (const plan of all) {
        const seen = new Set<number>();
        let current = -1;
        for (const f of plan.floors) {
          if (f.building !== current) {
            expect(seen.has(f.building)).toBe(false);
            seen.add(f.building);
            current = f.building;
          }
        }
      }
    });

    it('keeps the props inside the ground and under their caps', () => {
      for (const plan of all) {
        const count = (kind: string): number => plan.props.filter((p) => p.kind === kind).length;
        expect(count('lamp')).toBeLessThanOrEqual(MAX_LAMPS);
        expect(count('sign')).toBeLessThanOrEqual(MAX_SIGNS);
        expect(count('beacon')).toBeLessThanOrEqual(MAX_BEACONS);
        for (const p of plan.props) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.z).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(GROUND_WIDTH);
          expect(p.z).toBeLessThanOrEqual(GROUND_DEPTH);
        }
      }
    });
  });

  describe('variation over 100 seeds', () => {
    const hundred = plans(100);

    it('mixes the archetypes differently from seed to seed', () => {
      const mixes = hundred.map((plan) =>
        [...plan.buildings.map((b) => b.archetypeId)].sort().join(','),
      );
      expect(distinct(mixes)).toBeGreaterThanOrEqual(95);
      const used = new Set(hundred.flatMap((p) => p.buildings.map((b) => b.archetypeId)));
      expect(used.size).toBe(ARCHETYPES.length);
    });

    it('gives different height profiles', () => {
      const profiles = hundred.map((plan) => plan.buildings.map((b) => b.height));
      expect(distinct(profiles)).toBeGreaterThanOrEqual(95);
    });

    it('moves the landmarks around', () => {
      const places = hundred.map((plan) =>
        plan.buildings.filter((b) => b.landmark).map((b) => b.lotId),
      );
      expect(distinct(places)).toBeGreaterThanOrEqual(30);
    });

    it('names the landmarks differently', () => {
      const names = hundred.flatMap((p) => p.buildings.map((b) => b.name));
      expect(distinct(names)).toBeGreaterThanOrEqual(20);
    });
  });

  describe('data-driven (Open/Closed)', () => {
    const box: Archetype = {
      id: 'box',
      weight: 1,
      floors: { min: 2, max: 12 },
      landmarkFloors: { min: 12, max: 20 },
      minLotArea: 1,
      buildSections: (lot, levels) => [
        { rect: { x: lot.x, z: lot.z, w: lot.w, d: lot.d }, fromLevel: 0, toLevel: levels },
      ],
    };

    it('uses the archetypes it is given, with no generator change', () => {
      const plan = generateCityPlan(seedOf(3), { archetypes: [box] });
      expect(new Set(plan.buildings.map((b) => b.archetypeId))).toEqual(new Set(['box']));
      expect(plan.totalFloors).toBeGreaterThanOrEqual(MIN_TOTAL_FLOORS);
      expect(plan.totalFloors).toBeLessThanOrEqual(MAX_TOTAL_FLOORS);
    });

    const sized = (id: string, weight: number, min: number, max: number): Archetype => ({
      id,
      weight,
      floors: { min, max },
      landmarkFloors: { min: 12, max: 14 },
      minLotArea: 1,
      buildSections: (lot, levels) => [
        { rect: { x: lot.x, z: lot.z, w: lot.w, d: lot.d }, fromLevel: 0, toLevel: levels },
      ],
    });

    it('swaps archetypes when heights alone cannot trim the total', () => {
      const plan = generateCityPlan(seedOf(6), {
        archetypes: [sized('huge', 100, 12, 14), sized('tiny', 1, 2, 3)],
      });
      expect(plan.totalFloors).toBeGreaterThanOrEqual(MIN_TOTAL_FLOORS);
      expect(plan.totalFloors).toBeLessThanOrEqual(MAX_TOTAL_FLOORS);
      expect(plan.buildings.some((b) => b.archetypeId === 'tiny')).toBe(true);
    });

    it('swaps archetypes when heights alone cannot raise the total', () => {
      const plan = generateCityPlan(seedOf(7), {
        archetypes: [sized('tiny', 100, 2, 3), sized('big', 0, 16, 20)],
      });
      expect(plan.totalFloors).toBeGreaterThanOrEqual(MIN_TOTAL_FLOORS);
      expect(plan.totalFloors).toBeLessThanOrEqual(MAX_TOTAL_FLOORS);
      expect(plan.buildings.some((b) => b.archetypeId === 'big')).toBe(true);
    });

    it('names landmarks from the name parts it is given', () => {
      const plan = generateCityPlan(seedOf(4), {
        towerNames: { prefixes: ['ZED'], suffixes: ['A', 'B', 'C', 'D'] },
      });
      for (const b of plan.buildings.filter((x) => x.landmark)) {
        expect(b.name).toMatch(/^ZED [A-D]$/);
      }
    });

    it('ships at least six archetypes with unique ids', () => {
      expect(ARCHETYPES.length).toBeGreaterThanOrEqual(6);
      expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(ARCHETYPES.length);
    });
  });
});
