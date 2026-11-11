import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { CITY_PALETTES } from '@/lib/city/plan/city-palettes';
import { contrastRatio, shiftHue } from '@/lib/city/plan/color-math';
import {
  ENVIRONMENT_COLORS,
  MIN_COLOR_CONTRAST,
} from '@/lib/city/plan/environment-colors';
import { MAX_HUE_SHIFT } from '@/lib/city/plan/limits';
import type { CityPlan, Lot } from '@/lib/city/plan/city-plan.types';

const seedOf = (index: number): number => hashString(`session-${String(index)}`);
const plans = (count: number): CityPlan[] =>
  Array.from({ length: count }, (_, index) => generateCityPlan(seedOf(index)));
const distinct = (values: ReadonlyArray<unknown>): number =>
  new Set(values.map((value) => JSON.stringify(value))).size;
const HEX = /^#[0-9a-f]{6}$/;

const sharesEdge = (a: Lot, b: Lot): boolean => {
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapZ = a.z < b.z + b.d && b.z < a.z + a.d;
  return (
    ((a.x + a.w === b.x || b.x + b.w === a.x) && overlapZ) ||
    ((a.z + a.d === b.z || b.z + b.d === a.z) && overlapX)
  );
};

describe('city palettes (CR6.T3)', () => {
  it('ships at least five palettes with unique ids and six distinct colors', () => {
    expect(CITY_PALETTES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(CITY_PALETTES.map((p) => p.id)).size).toBe(CITY_PALETTES.length);
    for (const palette of CITY_PALETTES) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(6);
      expect(new Set(palette.colors).size).toBe(palette.colors.length);
      for (const color of [...palette.colors, palette.window, palette.lamp, palette.beacon]) {
        expect(color).toMatch(HEX);
      }
    }
  });

  it('stays readable on the black floor at every hue shift', () => {
    const failures: string[] = [];
    for (const palette of CITY_PALETTES) {
      for (let shift = -MAX_HUE_SHIFT; shift <= MAX_HUE_SHIFT; shift += 1) {
        for (const color of palette.colors) {
          const shifted = shiftHue(color, shift);
          if (contrastRatio(shifted, ENVIRONMENT_COLORS.floor) < MIN_COLOR_CONTRAST) {
            failures.push(`${palette.id} ${color} ${String(shift)}`);
          }
        }
      }
      for (const accent of [palette.window, palette.lamp, palette.beacon]) {
        if (contrastRatio(accent, ENVIRONMENT_COLORS.floor) < MIN_COLOR_CONTRAST) {
          failures.push(`${palette.id} accent ${accent}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('environment colors (CR6.T3)', () => {
  it('are fixed constants, outside every palette', () => {
    expect(ENVIRONMENT_COLORS).toEqual({
      floor: '#000000',
      grid: '#7dfba0',
      rain: '#7dfba0',
      hud: '#7dfba0',
    });
    const used = new Set(CITY_PALETTES.flatMap((p) => [...p.colors, p.window, p.lamp, p.beacon]));
    for (const color of Object.values(ENVIRONMENT_COLORS)) expect(used.has(color)).toBe(false);
  });

  it('are not touched by the seed', () => {
    const [a, b] = [generateCityPlan(1), generateCityPlan(2)];
    expect(Object.keys(a)).not.toContain('environment');
    expect(Object.keys(b)).not.toContain('environment');
  });
});

describe('generateCityPlan — colors (CR6.T3)', () => {
  it('is deterministic: the same seed gives the same palette, shift and colors', () => {
    const a = generateCityPlan(seedOf(9));
    const b = generateCityPlan(seedOf(9));
    expect(a.paletteId).toBe(b.paletteId);
    expect(a.hueShift).toBe(b.hueShift);
    expect(a.buildings.map((x) => x.color)).toEqual(b.buildings.map((x) => x.color));
  });

  it('does not use the domain-hash palette module', () => {
    const dir = resolve(import.meta.dirname, '../../../../../lib/city/plan');
    for (const name of readdirSync(dir)) {
      expect(readFileSync(resolve(dir, name), 'utf8')).not.toMatch(
        /getBuildingColor|city\/palette'|from '\.\/palette'/,
      );
    }
  });

  describe('invariants over 1,000 seeds', { timeout: 20_000 }, () => {
    const all = plans(1000);

    it('takes a known palette and an integer hue shift inside the range', () => {
      const ids = new Set(CITY_PALETTES.map((p) => p.id));
      for (const plan of all) {
        expect(ids.has(plan.paletteId)).toBe(true);
        expect(Number.isInteger(plan.hueShift)).toBe(true);
        expect(Math.abs(plan.hueShift)).toBeLessThanOrEqual(MAX_HUE_SHIFT);
      }
    });

    it('colors every building from its shifted palette, readable on the floor', () => {
      const offenders: string[] = [];
      for (const plan of all) {
        const palette = CITY_PALETTES.find((p) => p.id === plan.paletteId);
        const allowed = new Set(palette?.colors.map((c) => shiftHue(c, plan.hueShift)));
        for (const b of plan.buildings) {
          const ok =
            HEX.test(b.color) &&
            allowed.has(b.color) &&
            contrastRatio(b.color, ENVIRONMENT_COLORS.floor) >= MIN_COLOR_CONTRAST &&
            contrastRatio(b.windowColor, ENVIRONMENT_COLORS.floor) >= MIN_COLOR_CONTRAST;
          if (!ok) offenders.push(`${String(plan.seed)}:${String(b.id)}`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it('never gives two buildings that share an edge the same color', () => {
      const offenders: string[] = [];
      for (const plan of all) {
        const { buildings, lots } = plan;
        for (let i = 0; i < buildings.length; i += 1) {
          for (let j = i + 1; j < buildings.length; j += 1) {
            const [a, b] = [buildings[i], buildings[j]];
            const [la, lb] = [lots[a?.lotId ?? -1], lots[b?.lotId ?? -1]];
            if (a && b && la && lb && a.color === b.color && sharesEdge(la, lb)) {
              offenders.push(`${String(plan.seed)}:${String(i)}-${String(j)}`);
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });

    it('gives every prop a readable color', () => {
      for (const plan of all.slice(0, 200)) {
        for (const p of plan.props) {
          expect(p.color).toMatch(HEX);
          expect(contrastRatio(p.color, ENVIRONMENT_COLORS.floor)).toBeGreaterThanOrEqual(
            MIN_COLOR_CONTRAST,
          );
        }
      }
    });

    it('colors a sign like its building', () => {
      for (const plan of all.slice(0, 200)) {
        for (const p of plan.props.filter((x) => x.kind === 'sign')) {
          expect(p.color).toBe(plan.buildings[p.building ?? -1]?.color);
        }
      }
    });
  });

  describe('variation over 100 seeds', () => {
    const hundred = plans(100);

    it('uses several palettes and several hue shifts', () => {
      expect(distinct(hundred.map((p) => p.paletteId))).toBeGreaterThanOrEqual(4);
      expect(distinct(hundred.map((p) => p.hueShift))).toBeGreaterThanOrEqual(10);
    });

    it('colors the same lots differently from seed to seed', () => {
      expect(distinct(hundred.map((p) => p.buildings.map((b) => b.color)))).toBeGreaterThanOrEqual(95);
    });
  });

  it('draws from the palettes it is given (Open/Closed)', () => {
    const custom = {
      id: 'mono',
      name: 'Mono',
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
      window: '#ffffff',
      lamp: '#ffffff',
      beacon: '#ffffff',
    };
    const plan = generateCityPlan(seedOf(2), { palettes: [custom] });
    expect(plan.paletteId).toBe('mono');
  });
});
