import type {
  CityPalette,
  GroundPlan,
  Lot,
  PlanBuilding,
  PlanProp,
  BuildingShape,
  PropShape,
} from './city-plan.types';
import { shiftHue } from './color-math';
import { MAX_HUE_SHIFT } from './limits';
import { nextInt, pickWeighted, type SeededRandom } from './rng';

/** The palette a session uses and its colors after the hue shift. */
export interface PlanStyle {
  readonly palette: CityPalette;
  readonly hueShift: number;
  readonly colors: ReadonlyArray<string>;
}

/**
 * Pick a palette and an integer hue shift from the seed. An empty list is a
 * programming error (the shipped `CITY_PALETTES` is never empty), not an input.
 */
export function chooseStyle(
  rng: SeededRandom,
  palettes: ReadonlyArray<CityPalette>,
): PlanStyle {
  const palette = pickWeighted(rng, palettes, () => 1);
  if (palette === undefined) throw new Error('chooseStyle needs at least one palette');
  const hueShift = nextInt(rng, -MAX_HUE_SHIFT, MAX_HUE_SHIFT);
  return { palette, hueShift, colors: palette.colors.map((c) => shiftHue(c, hueShift)) };
}

/** Whether two lots touch along a side (not just at a corner, not across a road). */
function sharesEdge(a: Lot, b: Lot): boolean {
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapZ = a.z < b.z + b.d && b.z < a.z + a.d;
  return (
    ((a.x + a.w === b.x || b.x + b.w === a.x) && overlapZ) ||
    ((a.z + a.d === b.z || b.z + b.d === a.z) && overlapX)
  );
}

/**
 * A color for every building, so that buildings sharing an edge never share a
 * color: each takes a random color not used by the neighbours already colored,
 * or the least used among them in the (unlikely) case all are taken.
 */
export function colorBuildings(
  ground: GroundPlan,
  shapes: ReadonlyArray<BuildingShape>,
  style: PlanStyle,
  rng: SeededRandom,
): PlanBuilding[] {
  const colored: PlanBuilding[] = [];
  for (const shape of shapes) {
    const lot = ground.lots[shape.lotId];
    const around = colored.flatMap((other) => {
      const otherLot = ground.lots[other.lotId];
      return lot && otherLot && sharesEdge(lot, otherLot) ? [other.color] : [];
    });
    const uses = (color: string): number => around.filter((c) => c === color).length;
    const fewest = Math.min(...style.colors.map(uses));
    const options = style.colors.filter((color) => uses(color) === fewest);
    const color = pickWeighted(rng, options, () => 1) ?? style.colors[0] ?? '#ffffff';
    colored.push({ ...shape, color, windowColor: style.palette.window });
  }
  return colored;
}

/**
 * Lamps and beacons take the palette's accents. A sign takes another color of
 * the palette than its building, so the neon strip stands out from the edges
 * behind it (picked by the building id: no randomness needed).
 */
export function colorProps(
  props: ReadonlyArray<PropShape>,
  buildings: ReadonlyArray<PlanBuilding>,
  style: PlanStyle,
): PlanProp[] {
  return props.map((prop) => {
    if (prop.kind === 'lamp') return { ...prop, color: style.palette.lamp };
    if (prop.kind === 'beacon') return { ...prop, color: style.palette.beacon };
    const owner = prop.building === null ? undefined : buildings[prop.building];
    const others = style.colors.filter((color) => color !== owner?.color);
    const color = others[(owner?.id ?? 0) % Math.max(others.length, 1)] ?? style.palette.lamp;
    return { ...prop, color };
  });
}
