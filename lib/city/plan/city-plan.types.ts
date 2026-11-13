/** A rectangle of ground cells: `x`/`z` is its corner, `w`/`d` its size. */
export interface CellRect {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
}

/** A strip of road, one cell wide. */
export type RoadSegment = CellRect;

/** A plot a building can stand on. `id` is its index in `GroundPlan.lots`. */
export interface Lot extends CellRect {
  readonly id: number;
}

/**
 * One road of a layout, in the layout's own coordinates. `axis: 'x'` runs
 * along x on row `at`, from column `from` to `to` (both included); `axis: 'z'`
 * runs along z on column `at`, from row `from` to `to`.
 */
export interface RoadSpec {
  readonly axis: 'x' | 'z';
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/**
 * A road layout (data, Open/Closed): the whole layout moves rigidly by an
 * offset of at most `maxOffset` cells on each axis, so its roads stay
 * connected; anything pushed outside the ground is clipped.
 */
export interface RoadLayout {
  readonly id: string;
  readonly maxOffset: number;
  readonly roads: ReadonlyArray<RoadSpec>;
}

/** A lot footprint and its relative frequency. */
export interface Footprint {
  readonly w: number;
  readonly d: number;
  readonly weight: number;
}

export interface GroundOptions {
  readonly layouts?: ReadonlyArray<RoadLayout>;
  readonly footprints?: ReadonlyArray<Footprint>;
}

export interface GroundPlan {
  readonly seed: number;
  readonly layoutId: string;
  readonly offset: { readonly x: number; readonly z: number };
  readonly bounds: { readonly width: number; readonly depth: number };
  readonly roads: ReadonlyArray<RoadSegment>;
  readonly lots: ReadonlyArray<Lot>;
}

/** A box of a building: a ground rectangle (in cells) over floors [from, to). */
export interface Section {
  readonly rect: CellRect;
  readonly fromLevel: number;
  readonly toLevel: number;
}

export interface FloorRange {
  readonly min: number;
  readonly max: number;
}

/**
 * A building type (data, Open/Closed). `floors` is the range in levels;
 * `landmarkFloors` is set only for types that can be a landmark tower.
 * `buildSections` is pure and gets the lot and the chosen height in levels.
 */
export interface Archetype {
  readonly id: string;
  readonly weight: number;
  readonly floors: FloorRange;
  readonly landmarkFloors?: FloorRange;
  readonly minLotArea: number;
  readonly buildSections: (lot: CellRect, levels: number) => ReadonlyArray<Section>;
}

export interface TowerNameParts {
  readonly prefixes: ReadonlyArray<string>;
  readonly suffixes: ReadonlyArray<string>;
}

/**
 * `id` is the index in `CityPlan.buildings`; `height` is in levels. `color`
 * tints the body and edges, `windowColor` the lit windows (CR6.T3).
 */
export interface PlanBuilding {
  readonly id: number;
  readonly lotId: number;
  readonly archetypeId: string;
  readonly height: number;
  readonly landmark: boolean;
  readonly name: string | null;
  readonly sections: ReadonlyArray<Section>;
  readonly color: string;
  readonly windowColor: string;
}

/** A building before its colors are assigned. */
export type BuildingShape = Omit<PlanBuilding, 'color' | 'windowColor'>;

/** A session palette (data, Open/Closed) with the accents of windows, lamps and beacons. */
export interface CityPalette {
  readonly id: string;
  readonly name: string;
  readonly colors: ReadonlyArray<string>;
  readonly window: string;
  readonly lamp: string;
  readonly beacon: string;
}

/** One floor in build order: a level of a section of a building. */
export interface PlanFloor {
  readonly building: number;
  readonly level: number;
  readonly section: number;
}

export type PropKind = 'lamp' | 'sign' | 'beacon';

/**
 * `x`/`z` in cells, `level` in floors above the ground. A sign is a vertical
 * neon strip standing on one face of its building: `side` is the face (`x` the
 * face at the highest x, `z` the one at the highest z, both turned to the
 * camera), `x`/`z` the middle of the strip on that face, `level` its lowest
 * floor and `span` its height in floors. Lamps and beacons have neither.
 */
export interface PlanProp {
  readonly kind: PropKind;
  readonly x: number;
  readonly z: number;
  readonly level: number;
  readonly building: number | null;
  readonly color: string;
  readonly span?: number;
  readonly side?: 'x' | 'z';
}

/** A prop before its color is assigned. */
export type PropShape = Omit<PlanProp, 'color'>;

export interface PlanOptions extends GroundOptions {
  readonly archetypes?: ReadonlyArray<Archetype>;
  readonly towerNames?: TowerNameParts;
  readonly palettes?: ReadonlyArray<CityPalette>;
}

export interface CityPlan extends GroundPlan {
  readonly paletteId: string;
  readonly hueShift: number;
  readonly buildings: ReadonlyArray<PlanBuilding>;
  readonly floors: ReadonlyArray<PlanFloor>;
  readonly props: ReadonlyArray<PlanProp>;
  readonly totalFloors: number;
}
