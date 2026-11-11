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
