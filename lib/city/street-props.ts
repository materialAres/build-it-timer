/**
 * Street furniture for the foreground layer (roadmap M2.T12: "street/cars/
 * trees"). Data only: no selection logic here (Open/Closed, §1.1) — the growth
 * engine decides where each prop stands. Every row of a prop has exactly the
 * same width; spaces are transparent (the silhouette), so the prop only draws
 * its visible characters. Rows are listed top → bottom and stand directly on
 * the road row. Props are at most 2 rows tall: the street band is sized from the
 * tallest prop (see `maxStreetPropRows`), so none of them is ever filtered out.
 */
export interface StreetProp {
  readonly id: string;
  readonly rows: ReadonlyArray<string>;
}

export const STREET_PROPS: ReadonlyArray<StreetProp> = [
  { id: 'tree-large', rows: [' @@@ ', '@@|@@'] },
  { id: 'tree-pine', rows: [' ^ ', '/|\\'] },
  { id: 'streetlight', rows: [' * ', ' | '] },
  { id: 'car', rows: [' .--. ', 'o----o'] },
  { id: 'bush', rows: ['(@@)'] },
  { id: 'bench', rows: ['[===]'] },
];

/** Width of a prop in characters (all its rows share it). */
export function streetPropWidth(prop: StreetProp): number {
  return prop.rows[0]?.length ?? 0;
}

/** Height in rows of the tallest prop (the road row is not counted). */
export function maxStreetPropRows(): number {
  return STREET_PROPS.reduce((max, prop) => Math.max(max, prop.rows.length), 0);
}
