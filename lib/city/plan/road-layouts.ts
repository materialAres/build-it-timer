import type { Footprint, RoadLayout } from './city-plan.types';

/**
 * Road layouts on the 12 × 10 ground (data, Open/Closed): adding one is adding
 * an element here. Keep every road at least `maxOffset` cells from the frame
 * edge unless it spans the whole ground, so a shifted layout stays connected.
 */
export const ROAD_LAYOUTS: ReadonlyArray<RoadLayout> = [
  {
    // one avenue across, two streets down
    id: 'grid',
    maxOffset: 1,
    roads: [
      { axis: 'x', at: 4, from: 0, to: 11 },
      { axis: 'z', at: 3, from: 0, to: 9 },
      { axis: 'z', at: 8, from: 0, to: 9 },
    ],
  },
  {
    id: 'crossroads',
    maxOffset: 1,
    roads: [
      { axis: 'x', at: 4, from: 0, to: 11 },
      { axis: 'z', at: 6, from: 0, to: 9 },
    ],
  },
  {
    // an avenue along the top with three side streets
    id: 'comb',
    maxOffset: 1,
    roads: [
      { axis: 'x', at: 2, from: 0, to: 11 },
      { axis: 'z', at: 2, from: 2, to: 9 },
      { axis: 'z', at: 5, from: 2, to: 9 },
      { axis: 'z', at: 8, from: 2, to: 9 },
    ],
  },
  {
    // a loop road around a core
    id: 'ring',
    maxOffset: 1,
    roads: [
      { axis: 'x', at: 2, from: 2, to: 9 },
      { axis: 'x', at: 7, from: 2, to: 9 },
      { axis: 'z', at: 2, from: 2, to: 7 },
      { axis: 'z', at: 9, from: 2, to: 7 },
    ],
  },
];

/**
 * Lot footprints and their frequency. Large and wide lots dominate so the city
 * has few, readable buildings; the generator falls back to smaller ones where a
 * block is too tight.
 */
export const LOT_FOOTPRINTS: ReadonlyArray<Footprint> = [
  { w: 1, d: 1, weight: 10 },
  { w: 2, d: 1, weight: 30 },
  { w: 1, d: 2, weight: 30 },
  { w: 2, d: 2, weight: 30 },
];
