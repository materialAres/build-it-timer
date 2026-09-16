export type CityLayerName = 'background' | 'middleground' | 'foreground';

export type CityGridData = ReadonlyArray<ReadonlyArray<CityCell>>;

export type BuildingModuleCategory = 'base' | 'floor' | 'top';

export interface CityCell {
    readonly char: string | null; // ASCII to be rendered, null if empty
    readonly color?: string; // hex color for the building
}

export interface CityGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: CityGridData;
}

export interface CityLayers {
  readonly background: CityGrid;
  readonly middleground: CityGrid;
  readonly foreground: CityGrid;
}

export interface BuildingModule {
  readonly id: string;
  readonly category: BuildingModuleCategory;
  readonly widthChars: number;
  readonly rows: ReadonlyArray<string>; // ASCII rows
}

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly palette: ReadonlyArray<string>; // available hex colors
  readonly backgroundColor: string;
}

export interface ComposedBuilding {
  readonly moduleIds: ReadonlyArray<string>; // which modules have already been chosen
  readonly rows: ReadonlyArray<string>;       // resulting ASCII, ready to be written in the row
  readonly widthChars: number;
}

export interface SeededRandom {
  readonly next: () => number; // return a float [0,1), deterministic given the seed
}
