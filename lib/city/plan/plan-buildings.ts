import type {
  Archetype,
  GroundPlan,
  Lot,
  BuildingShape,
  TowerNameParts,
} from './city-plan.types';
import { eligibleArchetypes, rangeOf } from './building-archetypes';
import { fitTotalFloors, type DraftBuilding } from './fit-total-floors';
import { MAX_LANDMARKS, MAX_PARK_SHARE, MIN_LANDMARKS } from './limits';
import { nextInt, pickWeighted, shuffled, type SeededRandom } from './rng';
import { pickTowerName } from './tower-names';

/** Lots left empty as parks: none up to the park share of all lots. */
function pickParks(lots: ReadonlyArray<Lot>, rng: SeededRandom): Set<number> {
  const count = nextInt(rng, 0, Math.floor(lots.length * MAX_PARK_SHARE));
  return new Set(shuffled(rng, lots).slice(0, count).map((lot) => lot.id));
}

/** Landmark lots: larger lots first, chosen at random among them. */
function pickLandmarks(
  lots: ReadonlyArray<Lot>,
  rng: SeededRandom,
): Set<number> {
  const count = nextInt(rng, MIN_LANDMARKS, MAX_LANDMARKS);
  const large = shuffled(rng, lots.filter((lot) => lot.w * lot.d >= 2));
  const rest = shuffled(rng, lots.filter((lot) => lot.w * lot.d < 2));
  return new Set([...large, ...rest].slice(0, count).map((lot) => lot.id));
}

function draftFor(
  lot: Lot,
  landmark: boolean,
  archetypes: ReadonlyArray<Archetype>,
  rng: SeededRandom,
): DraftBuilding | undefined {
  const options = eligibleArchetypes(archetypes, lot, landmark);
  const archetype = pickWeighted(rng, options, (a) => a.weight);
  if (archetype === undefined) return undefined;
  const range = rangeOf(archetype, landmark);
  return { lot, archetype, height: nextInt(rng, range.min, range.max), landmark };
}

/**
 * A building on every lot that is not a park: archetype by weight, height inside
 * its range, 1–3 landmark towers, then a floor fit so the total stays inside
 * the plan bounds. Landmarks get a unique generated name.
 */
export function placeBuildings(
  ground: GroundPlan,
  rng: SeededRandom,
  archetypes: ReadonlyArray<Archetype>,
  names: TowerNameParts,
): BuildingShape[] {
  const parks = pickParks(ground.lots, rng);
  const landmarks = pickLandmarks(
    ground.lots.filter((lot) => !parks.has(lot.id)),
    rng,
  );
  const drafts = ground.lots.flatMap((lot) => {
    if (parks.has(lot.id)) return [];
    const draft = draftFor(lot, landmarks.has(lot.id), archetypes, rng);
    return draft === undefined ? [] : [draft];
  });
  const used = new Set<string>();
  return fitTotalFloors(drafts, archetypes, rng).map((draft, id) => ({
    id,
    lotId: draft.lot.id,
    archetypeId: draft.archetype.id,
    height: draft.height,
    landmark: draft.landmark,
    name: draft.landmark ? pickTowerName(rng, used, names) : null,
    sections: draft.archetype.buildSections(draft.lot, draft.height),
  }));
}
