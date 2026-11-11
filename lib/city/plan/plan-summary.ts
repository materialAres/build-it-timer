import type { CityPlan } from './city-plan.types';
import type { VisibleFloors } from './visible-floors';

/**
 * The facts a screen reader is told about the city. `milestone` (0–10) moves in
 * steps of 10% of the floors, so the view announces milestones, not every floor.
 */
export interface PlanSummary {
  /** Buildings with at least one complete floor. */
  readonly buildings: number;
  readonly floorsBuilt: number;
  readonly floorsTotal: number;
  /** Levels of the tallest building standing so far. */
  readonly tallestLevels: number;
  /** Its landmark name, or null for an unnamed building. */
  readonly tallestName: string | null;
  readonly milestone: number;
}

/** A pure summary of what is standing; the component words it (i18n) at milestones. */
export function summarizePlan(plan: CityPlan, visible: VisibleFloors): PlanSummary {
  const floorsTotal = plan.totalFloors;
  const complete = Math.min(Math.max(0, visible.complete), floorsTotal);
  const levels = new Map<number, number>();
  for (const floor of plan.floors.slice(0, complete)) {
    levels.set(floor.building, Math.max(levels.get(floor.building) ?? 0, floor.level + 1));
  }
  let tallestId = -1;
  let tallestLevels = 0;
  for (const [id, height] of levels) {
    if (height > tallestLevels) {
      tallestLevels = height;
      tallestId = id;
    }
  }
  return {
    buildings: levels.size,
    floorsBuilt: complete,
    floorsTotal,
    tallestLevels,
    tallestName: plan.buildings[tallestId]?.name ?? null,
    milestone: floorsTotal > 0 ? Math.min(10, Math.floor((complete * 10) / floorsTotal)) : 0,
  };
}
