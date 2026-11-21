import { describe, it, expect } from 'vitest';
import {
  malusForDistractionTicks,
  MALUS_ESCALATION_SCHEDULE,
} from '@/lib/score/malus-escalation';

describe('malusForDistractionTicks (M4.T1, moved by CR6.T5b)', () => {
  it('owes no additional malus before any distraction tick has elapsed', () => {
    expect(malusForDistractionTicks(0)).toBe(0);
  });

  it('grows strictly as soon as time is spent on the blocked site', () => {
    expect(malusForDistractionTicks(1)).toBe(1);
    expect(malusForDistractionTicks(2)).toBeGreaterThan(malusForDistractionTicks(1));
  });

  it('is monotonic non-decreasing over a table of increasing times', () => {
    const cases = [0, 1, 2, 3, 5, 6, 7, 11, 12, 20, 60, 300];

    let previous = -1;
    for (const ticks of cases) {
      const malus = malusForDistractionTicks(ticks);
      expect(malus).toBeGreaterThanOrEqual(previous);
      previous = malus;
    }
  });

  it('never dips over a dense, increasing range (no smaller malus for more time)', () => {
    let previous = 0;
    for (let ticks = 0; ticks <= 240; ticks += 1) {
      const malus = malusForDistractionTicks(ticks);
      expect(malus).toBeGreaterThanOrEqual(previous);
      previous = malus;
    }
  });

  it('escalates: later ticks cost more than earlier ones (not merely linear)', () => {
    // Ticks 1..5 cost 1 (5 total); 6..11 cost 2 (12 more) -> 17; 12+ cost 3.
    expect(malusForDistractionTicks(11)).toBe(17);
    expect(malusForDistractionTicks(17)).toBe(35);

    const firstStep = malusForDistractionTicks(1) - malusForDistractionTicks(0);
    const middleStep = malusForDistractionTicks(6) - malusForDistractionTicks(5);
    const lateStep = malusForDistractionTicks(12) - malusForDistractionTicks(11);

    expect(middleStep).toBeGreaterThan(firstStep);
    expect(lateStep).toBeGreaterThan(middleStep);
  });

  it('is total for non-finite, negative and fractional input', () => {
    expect(malusForDistractionTicks(Number.NaN)).toBe(0);
    expect(malusForDistractionTicks(-3)).toBe(0);
    expect(malusForDistractionTicks(Number.POSITIVE_INFINITY)).toBe(0);
    expect(malusForDistractionTicks(3.9)).toBe(malusForDistractionTicks(3));
  });

  it('is deterministic for the same input', () => {
    expect(malusForDistractionTicks(42)).toBe(malusForDistractionTicks(42));
  });

  it('uses an ordered escalation schedule of positive stages', () => {
    expect(MALUS_ESCALATION_SCHEDULE.length).toBeGreaterThan(0);
    for (const rule of MALUS_ESCALATION_SCHEDULE) {
      expect(rule.fromTicks).toBeGreaterThan(0);
      expect(rule.charactersPerTick).toBeGreaterThan(0);
    }

    const starts = MALUS_ESCALATION_SCHEDULE.map((rule) => rule.fromTicks);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});
