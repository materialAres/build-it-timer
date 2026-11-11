import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { summarizePlan } from '@/lib/city/plan/plan-summary';
import { visibleFloors } from '@/lib/city/plan/visible-floors';

const plan = generateCityPlan(hashString('session-summary'));
const at = (built: number): ReturnType<typeof summarizePlan> =>
  summarizePlan(plan, visibleFloors(plan, built, 600, 0));

describe('summarizePlan (CR6.T4)', () => {
  it('is empty before anything is built', () => {
    expect(at(0)).toEqual({
      buildings: 0,
      floorsBuilt: 0,
      floorsTotal: plan.totalFloors,
      tallestLevels: 0,
      tallestName: null,
      milestone: 0,
    });
  });

  it('describes the whole city once it is built', () => {
    const summary = at(600);
    expect(summary.buildings).toBe(plan.buildings.length);
    expect(summary.floorsBuilt).toBe(plan.totalFloors);
    expect(summary.milestone).toBe(10);
    expect(summary.tallestLevels).toBe(Math.max(...plan.buildings.map((b) => b.height)));
  });

  it('names the tallest building when it is a landmark', () => {
    const summary = at(600);
    const tallest = plan.buildings.find((b) => b.height === summary.tallestLevels);
    expect(summary.tallestName).toBe(tallest?.name ?? null);
  });

  it('counts only complete floors and standing buildings', () => {
    const partial = visibleFloors(plan, 301, 600, 0);
    const summary = summarizePlan(plan, partial);
    expect(summary.floorsBuilt).toBe(partial.complete);
    const standing = new Set(plan.floors.slice(0, partial.complete).map((f) => f.building));
    expect(summary.buildings).toBe(standing.size);
  });

  it('moves in steps of 10%, so a screen reader is not told about every floor', () => {
    const milestones = new Set<number>();
    for (let built = 0; built <= 600; built += 1) milestones.add(at(built).milestone);
    expect([...milestones].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('never decreases as the city grows', () => {
    let previous = at(0);
    for (let built = 1; built <= 600; built += 1) {
      const next = at(built);
      expect(next.floorsBuilt).toBeGreaterThanOrEqual(previous.floorsBuilt);
      expect(next.buildings).toBeGreaterThanOrEqual(previous.buildings);
      expect(next.tallestLevels).toBeGreaterThanOrEqual(previous.tallestLevels);
      previous = next;
    }
  });
});
