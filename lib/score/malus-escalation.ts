/**
 * The malus escalation (M4.T1, moved into the score by CR6.T5b, option A).
 * Pure data and arithmetic: no city, no browser.
 */

/**
 * How the malus escalates with the time spent on a blocked site (M4.T1). Each
 * rule means: from `fromTicks` whole distraction ticks onwards, every further
 * tick costs `charactersPerTick` characters instead of one. The tick length is
 * the session cadence (duration ÷ characters), the same clock the score uses,
 * so the penalty is the same share of the session at every preset. The schedule
 * is data (Open/Closed, §1.1): making the penalty harder or softer is an array
 * edit, never a change to the calculation below. Its first stage weighs the same
 * as the M2.T10 base cadence (one character per tick), so short stays keep the
 * previous behaviour and only longer stays become harsher.
 */
export interface MalusEscalationRule {
  readonly fromTicks: number;
  readonly charactersPerTick: number;
}

export const MALUS_ESCALATION_SCHEDULE: ReadonlyArray<MalusEscalationRule> = [
  { fromTicks: 1, charactersPerTick: 1 },
  { fromTicks: 6, charactersPerTick: 2 },
  { fromTicks: 12, charactersPerTick: 3 },
];

/**
 * Whole ticks of a (possibly untrusted) distraction time: non-finite or
 * negative input counts as 0 (§1.4), fractions are dropped.
 */
function normalizeTicks(ticksOfDistraction: number): number {
  if (!Number.isFinite(ticksOfDistraction)) return 0;
  return Math.max(0, Math.floor(ticksOfDistraction));
}

function tickCost(tickNumber: number): number {
  let cost = 0;
  for (const rule of MALUS_ESCALATION_SCHEDULE) {
    if (tickNumber >= rule.fromTicks) cost = rule.charactersPerTick;
  }
  return cost;
}

/**
 * Proportional malus (M4.T1): the characters owed for `ticksOfDistraction`
 * whole distraction ticks spent on a blocked site ("the malus grows as a
 * function of time spent"). Since CR6.T5b it is part of the score:
 * `calculateBuiltCharacters` subtracts it, so the score, the tier, the
 * population and the city all lose the same amount. The value is
 * cumulative and **monotonic non-decreasing** — more time can never yield a
 * smaller malus — because every tick contributes a non-negative cost. Pure and
 * total (non-finite/negative input is normalized to zero, mirroring
 * `applyMalus`), so it is unit-testable in isolation.
 */
export function malusForDistractionTicks(ticksOfDistraction: number): number {
  const ticks = normalizeTicks(ticksOfDistraction);
  let total = 0;
  for (let tick = 1; tick <= ticks; tick += 1) {
    total += tickCost(tick);
  }
  return total;
}
