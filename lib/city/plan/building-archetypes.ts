import type {
  Archetype,
  CellRect,
  FloorRange,
  Section,
} from './city-plan.types';

const inset = (lot: CellRect, margin: number): CellRect => ({
  x: lot.x + margin,
  z: lot.z + margin,
  w: lot.w - 2 * margin,
  d: lot.d - 2 * margin,
});

const box =
  (margin: number) =>
  (lot: CellRect, levels: number): ReadonlyArray<Section> => [
    { rect: inset(lot, margin), fromLevel: 0, toLevel: levels },
  ];

/** Three boxes, each narrower than the one below (setbacks). */
function stepped(lot: CellRect, levels: number): ReadonlyArray<Section> {
  const base = Math.ceil(levels * 0.5);
  const middle = base + Math.ceil(levels * 0.3);
  return [
    { rect: inset(lot, 0.1), fromLevel: 0, toLevel: base },
    { rect: inset(lot, 0.22), fromLevel: base, toLevel: middle },
    { rect: inset(lot, 0.34), fromLevel: middle, toLevel: levels },
  ];
}

/** Two towers side by side along the longer side of the lot. */
function twin(lot: CellRect, levels: number): ReadonlyArray<Section> {
  const alongX = lot.w >= lot.d;
  const half = (alongX ? lot.w : lot.d) / 2 - 0.2;
  const across = (alongX ? lot.d : lot.w) - 0.3;
  const towerAt = (offset: number): Section => ({
    rect: alongX
      ? { x: lot.x + offset, z: lot.z + 0.15, w: half, d: across }
      : { x: lot.x + 0.15, z: lot.z + offset, w: across, d: half },
    fromLevel: 0,
    toLevel: levels,
  });
  const second = (alongX ? lot.w : lot.d) / 2 + 0.1;
  return [towerAt(0.1), towerAt(second)];
}

const SPIRE_LEVELS = 3;

/** A box with a thin needle on top, counted in the building's levels. */
function spire(lot: CellRect, levels: number): ReadonlyArray<Section> {
  const main = levels - SPIRE_LEVELS;
  const cx = lot.x + lot.w / 2;
  const cz = lot.z + lot.d / 2;
  return [
    { rect: inset(lot, 0.2), fromLevel: 0, toLevel: main },
    { rect: { x: cx - 0.1, z: cz - 0.1, w: 0.2, d: 0.2 }, fromLevel: main, toLevel: levels },
  ];
}

/**
 * Building types (data, Open/Closed): adding one is adding an element here,
 * never a change to the generator. Ranges are in levels; a twin has two
 * floors per level. Landmarks are drawn only from types with `landmarkFloors`.
 */
export const ARCHETYPES: ReadonlyArray<Archetype> = [
  { id: 'tower', weight: 25, floors: { min: 5, max: 14 }, landmarkFloors: { min: 18, max: 26 }, minLotArea: 1, buildSections: box(0.15) },
  { id: 'slab', weight: 20, floors: { min: 2, max: 6 }, minLotArea: 2, buildSections: box(0.05) },
  { id: 'stepped', weight: 12, floors: { min: 8, max: 16 }, landmarkFloors: { min: 18, max: 26 }, minLotArea: 1, buildSections: stepped },
  { id: 'twin', weight: 15, floors: { min: 4, max: 10 }, minLotArea: 2, buildSections: twin },
  { id: 'spire', weight: 10, floors: { min: 8, max: 14 }, landmarkFloors: { min: 16, max: 24 }, minLotArea: 1, buildSections: spire },
  { id: 'lowBlock', weight: 18, floors: { min: 2, max: 4 }, minLotArea: 1, buildSections: box(0.02) },
];

/** The archetypes a lot can take, for a landmark or a regular building. */
export function eligibleArchetypes(
  archetypes: ReadonlyArray<Archetype>,
  lot: CellRect,
  landmark: boolean,
): ReadonlyArray<Archetype> {
  return archetypes.filter(
    (a) =>
      lot.w * lot.d >= a.minLotArea &&
      (!landmark || a.landmarkFloors !== undefined),
  );
}

export function rangeOf(archetype: Archetype, landmark: boolean): FloorRange {
  return (landmark ? archetype.landmarkFloors : undefined) ?? archetype.floors;
}

/** Floors (boxes of one level) a list of sections adds up to. */
export function floorCountOf(sections: ReadonlyArray<Section>): number {
  return sections.reduce((sum, s) => sum + (s.toLevel - s.fromLevel), 0);
}
