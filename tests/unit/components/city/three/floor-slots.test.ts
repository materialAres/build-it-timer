import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => (await import('./three-mock')).threeMock());

import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { createSceneFrame, createScenePlan, EDGES_PER_FLOOR } from '@/lib/city/plan/scene-data';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { DAMAGED_EDGE_COLOR } from '@/lib/city/plan/environment-colors';
import { visibleFloors } from '@/lib/city/plan/visible-floors';
import { edgeLines, floorMeshes, slotWriter } from '@/components/city/three/floor-slots';
import { resetMade } from './three-mock';

const plan = generateCityPlan(hashString('session-slots'));
const scene = createScenePlan(plan);
const partialFrame = createSceneFrame(scene, plan, visibleFloors(plan, 301, 600, 40));
const partial = partialFrame.partial;
if (partial === null) throw new Error('expected a partial floor');

const floatsPerEdgeSlot = EDGES_PER_FLOOR * 6;
const slice = (array: ArrayLike<number>, slot: number, size: number): number[] =>
  Array.from({ length: size }, (_, i) => array[slot * size + i] ?? 0);

function setup() {
  const floors = floorMeshes(scene);
  const lines = edgeLines(scene);
  const writer = slotWriter(scene, floors, lines);
  const body = (slot: number) => ({
    matrix: slice(floors.bodies.instanceMatrix.array, slot, 16),
    band: slice(floors.bands.instanceMatrix.array, slot, 16),
    color: slice(floors.bodies.instanceColor?.array ?? [], slot, 3),
    windows: slice(floors.bands.instanceColor?.array ?? [], slot, 3),
    edges: slice(lines.positions.array, slot, floatsPerEdgeSlot),
    edgeColors: slice(lines.colors.array, slot, floatsPerEdgeSlot),
  });
  return { writer, body };
}

describe('slotWriter (CR6.T7)', () => {
  beforeEach(resetMade);

  it('rests on the static data: a drawn slot equals its scene data', () => {
    const { writer, body } = setup();
    const resting = body(5);
    writer.draw(5, { shift: [0, 1.5, 0.3], glitch: 0.5 });
    expect(body(5)).not.toEqual(resting);
    writer.draw(5);
    expect(body(5)).toEqual(resting);
    expect(body(5).matrix).toEqual(slice(scene.matrices, 5, 16));
    expect(body(5).edges).toEqual(slice(scene.edges, 5, floatsPerEdgeSlot));
  });

  it('shifts the whole floor: body, band and edges move by the same offset', () => {
    const { writer, body } = setup();
    const resting = body(7);
    writer.draw(7, { shift: [0.2, 1, -0.4] });
    const moved = body(7);
    expect(moved.matrix[12]).toBeCloseTo((resting.matrix[12] ?? 0) + 0.2, 5);
    expect(moved.matrix[13]).toBeCloseTo((resting.matrix[13] ?? 0) + 1, 5);
    expect(moved.band[14]).toBeCloseTo((resting.band[14] ?? 0) - 0.4, 5);
    expect(moved.edges[1]).toBeCloseTo((resting.edges[1] ?? 0) + 1, 5);
    expect(moved.edges[2]).toBeCloseTo((resting.edges[2] ?? 0) - 0.4, 5);
    expect(moved.color).toEqual(resting.color);
  });

  it('draws the partly paid floor with its own box, no lit windows and dim bodies', () => {
    const { writer, body } = setup();
    const resting = body(partial.index);
    writer.draw(partial.index, { partial });
    const drawn = body(partial.index);
    expect(drawn.matrix).toEqual(Array.from(partial.matrix));
    expect(drawn.band.slice(0, 12).every((v) => v === 0)).toBe(true);
    expect(drawn.color[0]).toBeCloseTo((resting.color[0] ?? 0) * 0.5, 6);
  });

  it('paints a damaged partial floor red and a healthy one dimmer', () => {
    const { writer, body } = setup();
    const red = hexToUnitRgb(DAMAGED_EDGE_COLOR);
    writer.draw(partial.index, { partial: { ...partial, damaged: true } });
    expect(body(partial.index).edgeColors.slice(0, 3)).toEqual(Array.from(red).map((c) => Math.fround(c)));
    writer.draw(partial.index, { partial: { ...partial, damaged: false } });
    const dim = body(partial.index).edgeColors[0] ?? 0;
    expect(dim).toBeCloseTo((scene.edgeColors[partial.index * floatsPerEdgeSlot] ?? 0) * 0.5, 6);
  });

  it('multiplies the edge brightness by the glow', () => {
    const { writer, body } = setup();
    writer.draw(partial.index, { partial: { ...partial, damaged: true }, glow: 0.5 });
    expect(body(partial.index).edgeColors[0]).toBeCloseTo(Math.fround(hexToUnitRgb(DAMAGED_EDGE_COLOR)[0]) * 0.5, 5);
  });

  it('glitches in red: edges and body tinted red by the level, windows hidden, dark at level 0', () => {
    const { writer, body } = setup();
    const red = hexToUnitRgb(DAMAGED_EDGE_COLOR);
    writer.draw(3, { glitch: 1 });
    expect(body(3).edgeColors.slice(0, 3)).toEqual(Array.from(red).map((c) => Math.fround(c)));
    expect(body(3).band.slice(0, 12).every((v) => v === 0)).toBe(true);
    writer.draw(3, { glitch: 0 });
    expect(body(3).edgeColors.every((v) => v === 0)).toBe(true);
    expect(body(3).color.every((v) => v === 0)).toBe(true);
  });

  it('flickers a window band and restores it', () => {
    const { writer, body } = setup();
    const resting = body(9).windows;
    writer.setWindows(9, 0.25);
    expect(body(9).windows[0]).toBeCloseTo((resting[0] ?? 0) * 0.25, 6);
    writer.setWindows(9, 1);
    expect(body(9).windows).toEqual(resting);
  });

  it('never writes the scene data', () => {
    const before = Array.from(scene.edgeColors.subarray(0, 200));
    const { writer } = setup();
    writer.draw(0, { glitch: 1, glow: 0.2 });
    expect(Array.from(scene.edgeColors.subarray(0, 200))).toEqual(before);
  });
});
