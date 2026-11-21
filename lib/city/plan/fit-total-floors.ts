import type { Archetype, CellRect } from './city-plan.types';
import { eligibleArchetypes, floorCountOf, rangeOf } from './building-archetypes';
import { MAX_FIT_STEPS, MAX_TOTAL_FLOORS, MIN_TOTAL_FLOORS } from './limits';
import { nextInt, type SeededRandom } from './rng';

/** A building before its sections are built. */
export interface DraftBuilding {
  readonly lot: CellRect & { readonly id: number };
  readonly archetype: Archetype;
  readonly height: number;
  readonly landmark: boolean;
}

export function floorsOf(draft: DraftBuilding): number {
  return floorCountOf(draft.archetype.buildSections(draft.lot, draft.height));
}

function adjustable(draft: DraftBuilding, down: boolean): boolean {
  if (draft.landmark) return false;
  const range = rangeOf(draft.archetype, false);
  return down ? draft.height > range.min : draft.height < range.max;
}

/**
 * When no height can move further, swap one regular building for the type that
 * gives the lowest (`down`) or highest floor count, at its extreme height.
 */
function replacement(
  drafts: ReadonlyArray<DraftBuilding>,
  counts: ReadonlyArray<number>,
  all: ReadonlyArray<Archetype>,
  down: boolean,
): { index: number; draft: DraftBuilding } | undefined {
  let target = -1;
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (draft === undefined || draft.landmark) continue;
    const better = down ? (counts[i] ?? 0) > (counts[target] ?? -1) : target < 0 || (counts[i] ?? 0) < (counts[target] ?? 0);
    if (better) target = i;
  }
  const draft = drafts[target];
  if (draft === undefined) return undefined;
  const options = [...eligibleArchetypes(all, draft.lot, false)].sort((a, b) =>
    down ? a.floors.min - b.floors.min : b.floors.max - a.floors.max,
  );
  const archetype = options[0];
  if (archetype === undefined || archetype.id === draft.archetype.id) return undefined;
  const height = down ? archetype.floors.min : archetype.floors.max;
  return { index: target, draft: { ...draft, archetype, height } };
}

/**
 * Nudge regular buildings, one level at a time and chosen by the generator,
 * until the plan's floors are inside `MIN_TOTAL_FLOORS`–`MAX_TOTAL_FLOORS`.
 * Landmarks keep their height. With the shipped archetypes the bound is always
 * reached; custom data that cannot reach it gets the closest result.
 */
export function fitTotalFloors(
  drafts: ReadonlyArray<DraftBuilding>,
  all: ReadonlyArray<Archetype>,
  rng: SeededRandom,
): DraftBuilding[] {
  const result = [...drafts];
  const counts = result.map(floorsOf);
  let total = counts.reduce((sum, count) => sum + count, 0);
  for (let step = 0; step < MAX_FIT_STEPS; step += 1) {
    if (total >= MIN_TOTAL_FLOORS && total <= MAX_TOTAL_FLOORS) break;
    const down = total > MAX_TOTAL_FLOORS;
    const movable = result.flatMap((d, i) => (adjustable(d, down) ? [i] : []));
    const pick = movable[nextInt(rng, 0, movable.length - 1)];
    const draft = pick === undefined ? undefined : result[pick];
    const next =
      pick !== undefined && draft !== undefined
        ? { index: pick, draft: { ...draft, height: draft.height + (down ? -1 : 1) } }
        : replacement(result, counts, all, down);
    if (next === undefined) break;
    result[next.index] = next.draft;
    const count = floorsOf(next.draft);
    total += count - (counts[next.index] ?? 0);
    counts[next.index] = count;
  }
  return result;
}
