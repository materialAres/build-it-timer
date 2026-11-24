import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import {
  MAX_SIGNS,
  MIN_SIGN_BUILDING_LEVELS,
  MIN_SIGN_SPAN,
  SIGN_SPAN_SHARE,
} from '@/lib/city/plan/limits';
import type { CityPlan, PlanProp, Section } from '@/lib/city/plan/city-plan.types';

const plans: CityPlan[] = Array.from({ length: 150 }, (_, i) => generateCityPlan(hashString(`signs-${String(i)}`)));
const signsOf = (plan: CityPlan): PlanProp[] => plan.props.filter((p) => p.kind === 'sign');
const EPS = 1e-9;

/** The ground section whose camera-facing face the sign stands on. */
function sectionUnder(plan: CityPlan, sign: PlanProp): Section | undefined {
  const building = plan.buildings[sign.building ?? -1];
  return building?.sections.find((s) => {
    if (s.fromLevel !== 0) return false;
    const { x, z, w, d } = s.rect;
    if (sign.side === 'z') return Math.abs(sign.z - (z + d)) < EPS && sign.x > x && sign.x < x + w;
    return Math.abs(sign.x - (x + w)) < EPS && sign.z > z && sign.z < z + d;
  });
}

describe('vertical neon signs in the plan', () => {
  it('stays under the cap, and some cities have signs', () => {
    for (const plan of plans) expect(signsOf(plan).length).toBeLessThanOrEqual(MAX_SIGNS);
    expect(plans.filter((p) => signsOf(p).length > 0).length).toBeGreaterThan(plans.length * 0.9);
  });

  it('puts at most one sign on a building, never on a landmark or a spire', () => {
    for (const plan of plans) {
      const owners = signsOf(plan).map((s) => s.building);
      expect(new Set(owners).size).toBe(owners.length);
      for (const owner of owners) {
        const building = plan.buildings[owner ?? -1];
        expect(building?.landmark).toBe(false);
        expect(building?.archetypeId).not.toBe('spire');
      }
    }
  });

  it('stands on a camera-facing face (+x or +z) of the ground section', () => {
    for (const plan of plans) {
      for (const sign of signsOf(plan)) {
        expect(['x', 'z']).toContain(sign.side);
        expect(sectionUnder(plan, sign)).toBeDefined();
      }
    }
  });

  it('spans 40 to 70% of a section at least as tall as the minimum, and fits inside it', () => {
    for (const plan of plans) {
      for (const sign of signsOf(plan)) {
        const section = sectionUnder(plan, sign);
        if (section === undefined) throw new Error('sign off its building');
        const height = section.toLevel - section.fromLevel;
        const span = sign.span ?? 0;
        expect(height).toBeGreaterThanOrEqual(MIN_SIGN_BUILDING_LEVELS);
        expect(span).toBeGreaterThanOrEqual(MIN_SIGN_SPAN);
        expect(span).toBeGreaterThanOrEqual(Math.floor(height * SIGN_SPAN_SHARE.min));
        expect(span).toBeLessThanOrEqual(Math.max(MIN_SIGN_SPAN, Math.ceil(height * SIGN_SPAN_SHARE.max)));
        expect(sign.level).toBeGreaterThanOrEqual(0);
        expect(sign.level + span).toBeLessThanOrEqual(section.toLevel);
      }
    }
  });

  it('is the same for the same seed', () => {
    const seed = hashString('signs-again');
    expect(signsOf(generateCityPlan(seed))).toEqual(signsOf(generateCityPlan(seed)));
  });
});
