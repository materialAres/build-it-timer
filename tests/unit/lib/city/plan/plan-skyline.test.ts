import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import {
  SKYLINE_COLUMNS_PER_CELL,
  SKYLINE_ROWS,
  renderSkyline,
} from '@/lib/city/plan/plan-skyline';
import { visibleFloors, type VisibleFloors } from '@/lib/city/plan/visible-floors';

const plan = generateCityPlan(hashString('session-skyline'));
const at = (floors: number, partial = 0, damaged = false): VisibleFloors => ({
  complete: floors,
  partialFraction: partial,
  damaged,
});
const ink = (rows: string[]): number => rows.join('').replace(/[ _]/g, '').length;
const glyphs = (rows: string[]): Set<string> => new Set(rows.join(''));

describe('renderSkyline (CR6.T8b)', () => {
  it('is always the fixed size: 20 rows of one character per column', () => {
    const width = plan.bounds.width * SKYLINE_COLUMNS_PER_CELL;
    for (const visible of [at(0), at(1), at(120, 0.4, true), at(plan.totalFloors)]) {
      const rows = renderSkyline(plan, visible);
      expect(rows).toHaveLength(SKYLINE_ROWS);
      expect(rows.every((row) => row.length === width)).toBe(true);
    }
  });

  it('shows only the ground before anything is built', () => {
    const rows = renderSkyline(plan, at(0));
    expect(ink(rows)).toBe(0);
    expect(rows.at(-1)).toMatch(/^_+$/);
  });

  it('is deterministic and does not touch its input', () => {
    const visible = at(150, 0.5, false);
    expect(renderSkyline(plan, visible)).toEqual(renderSkyline(plan, visible));
    expect(visible).toEqual(at(150, 0.5, false));
  });

  it('grows with the floors and never shrinks while floors are added', () => {
    let previous = 0;
    for (let floors = 0; floors <= plan.totalFloors; floors += 10) {
      const amount = ink(renderSkyline(plan, at(floors)));
      expect(amount).toBeGreaterThanOrEqual(previous);
      previous = amount;
    }
    expect(previous).toBeGreaterThan(100);
  });

  it('uses only ASCII', () => {
    const used = glyphs(renderSkyline(plan, at(plan.totalFloors, 0.5, true)));
    for (const glyph of used) expect(glyph).toMatch(/^[\x20-\x7e]$/);
  });

  it('marks a floor under construction with = and a damaged one with !', () => {
    const building = renderSkyline(plan, at(100, 0.5, false));
    const damaged = renderSkyline(plan, at(100, 0.5, true));
    expect(glyphs(building).has('=')).toBe(true);
    expect(glyphs(building).has('!')).toBe(false);
    expect(glyphs(damaged).has('!')).toBe(true);
    expect(glyphs(damaged).has('=')).toBe(false);
  });

  it('draws no partial floor when none is partly paid', () => {
    const used = glyphs(renderSkyline(plan, at(100, 0, true)));
    expect(used.has('=') || used.has('!')).toBe(false);
  });

  it('shows the same floors as the 3D view: the visible floors decide, in build order', () => {
    const fromScore = renderSkyline(plan, visibleFloors(plan, 300, 600, 0));
    const direct = renderSkyline(plan, at(Math.floor((300 * plan.totalFloors) / 600), (300 * plan.totalFloors) / 600 % 1));
    expect(fromScore).toEqual(direct);
  });

  it('keeps the same scale as the city grows, so a building does not shrink', () => {
    const half = renderSkyline(plan, at(100));
    const more = renderSkyline(plan, at(101));
    const filled = (rows: string[], col: number): number => rows.filter((r) => r[col] !== ' ' && r[col] !== '_').length;
    for (let col = 0; col < plan.bounds.width * SKYLINE_COLUMNS_PER_CELL; col += 1) expect(filled(more, col)).toBeGreaterThanOrEqual(filled(half, col));
  });

  it('works for many plans and any visible floors without throwing', () => {
    const offenders: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const seed = hashString(`skyline-${String(i)}`);
      const p = generateCityPlan(seed);
      const rows = renderSkyline(p, at(Math.floor(p.totalFloors * ((i % 10) / 10)), (i % 7) / 7, i % 2 === 0));
      if (rows.length !== SKYLINE_ROWS) offenders.push(seed);
    }
    expect(offenders).toEqual([]);
  });

  it('is total: invalid floors show an empty city', () => {
    expect(ink(renderSkyline(plan, at(-5)))).toBe(0);
    expect(ink(renderSkyline(plan, at(Number.NaN)))).toBe(0);
    expect(renderSkyline(plan, at(plan.totalFloors * 10))).toEqual(renderSkyline(plan, at(plan.totalFloors)));
  });
});
