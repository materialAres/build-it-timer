import type { GroundPlan, PlanBuilding, PlanProp } from './city-plan.types';
import { MAX_BEACONS, MAX_LAMPS, MAX_SIGNS } from './limits';
import { shuffled, type SeededRandom } from './rng';

const LAMP_CHANCE = 0.3;
const SIGN_CHANCE = 1 / 3;

function lamps(ground: GroundPlan, rng: SeededRandom): PlanProp[] {
  const cells = new Map<string, { x: number; z: number }>();
  for (const road of ground.roads) {
    for (let x = road.x; x < road.x + road.w; x += 1) {
      for (let z = road.z; z < road.z + road.d; z += 1) {
        cells.set(`${String(x)},${String(z)}`, { x, z });
      }
    }
  }
  return [...cells.values()]
    .filter(() => rng.next() < LAMP_CHANCE)
    .slice(0, MAX_LAMPS)
    .map(({ x, z }) => ({ kind: 'lamp', x: x + 0.5, z: z + 0.5, level: 0, building: null }));
}

function signs(
  ground: GroundPlan,
  buildings: ReadonlyArray<PlanBuilding>,
  rng: SeededRandom,
): PlanProp[] {
  return shuffled(rng, buildings)
    .filter(() => rng.next() < SIGN_CHANCE)
    .slice(0, MAX_SIGNS)
    .flatMap((b) => {
      const lot = ground.lots[b.lotId];
      if (lot === undefined) return [];
      const level = Math.max(1, Math.floor(b.height / 2));
      return [{ kind: 'sign' as const, x: lot.x + lot.w / 2, z: lot.z + lot.d, level, building: b.id }];
    });
}

function beacons(
  ground: GroundPlan,
  buildings: ReadonlyArray<PlanBuilding>,
): PlanProp[] {
  return buildings
    .filter((b) => b.landmark || b.archetypeId === 'spire')
    .sort((a, b) => Number(b.landmark) - Number(a.landmark))
    .slice(0, MAX_BEACONS)
    .flatMap((b) => {
      const lot = ground.lots[b.lotId];
      if (lot === undefined) return [];
      return [{ kind: 'beacon' as const, x: lot.x + lot.w / 2, z: lot.z + lot.d / 2, level: b.height, building: b.id }];
    });
}

/**
 * Street lamps along the roads, signs on about a third of the buildings and
 * beacons on landmarks and spires (landmarks first), each under its cap.
 */
export function placeProps(
  ground: GroundPlan,
  buildings: ReadonlyArray<PlanBuilding>,
  rng: SeededRandom,
): PlanProp[] {
  return [...lamps(ground, rng), ...signs(ground, buildings, rng), ...beacons(ground, buildings)];
}
