import type { PlanBuilding, PlanFloor } from './city-plan.types';
import { shuffled, type SeededRandom } from './rng';

/**
 * Every floor of the plan in the order it appears as the session progresses:
 * buildings in a shuffled order, each one built bottom-up, level by level (all
 * the sections of a level before the next level), so no floor ever appears
 * before the one below it.
 */
export function orderFloors(
  buildings: ReadonlyArray<PlanBuilding>,
  rng: SeededRandom,
): PlanFloor[] {
  const floors: PlanFloor[] = [];
  for (const id of shuffled(rng, buildings.map((b) => b.id))) {
    const building = buildings[id];
    if (building === undefined) continue;
    for (let level = 0; level < building.height; level += 1) {
      building.sections.forEach((section, index) => {
        if (level >= section.fromLevel && level < section.toLevel) {
          floors.push({ building: id, level, section: index });
        }
      });
    }
  }
  return floors;
}
