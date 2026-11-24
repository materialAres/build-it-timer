import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import {
  EDGES_PER_FLOOR,
  EDGE_BRIGHTNESS,
  WINDOW_BRIGHTNESS,
  createSceneFrame,
  createScenePlan,
} from '@/lib/city/plan/scene-data';
import { hexToUnitRgb } from '@/lib/city/plan/color-math';
import { visibleFloors } from '@/lib/city/plan/visible-floors';
import { FLOOR_HEIGHT, MAX_BUILDING_FLOORS } from '@/lib/city/plan/limits';

const plan = generateCityPlan(hashString('session-scene'));
const scene = createScenePlan(plan);
const round = (values: ArrayLike<number>, digits = 4): number[] =>
  Array.from(values, (v) => Number(v.toFixed(digits)));
const sum = (values: ArrayLike<number>): number =>
  Number(Array.from(values).reduce((a, b) => a + b, 0).toFixed(3));

describe('createScenePlan (CR6.T4)', () => {
  it('matches the snapshot for a fixed seed', () => {
    expect({
      floorCount: scene.floorCount,
      matricesSum: sum(scene.matrices),
      colorsSum: sum(scene.colors),
      windowColorsSum: sum(scene.windowColors),
      edgesSum: sum(scene.edges),
      firstMatrix: round(scene.matrices.subarray(0, 16)),
      firstColor: round(scene.colors.subarray(0, 3)),
      labels: scene.labels.map((l) => ({
        name: l.name,
        position: round(l.position),
        endFloor: l.endFloor,
      })),
    }).toMatchSnapshot();
  });

  it('is deterministic', () => {
    const again = createScenePlan(plan);
    expect(Array.from(again.matrices)).toEqual(Array.from(scene.matrices));
    expect(Array.from(again.edges)).toEqual(Array.from(scene.edges));
  });

  it('has one instance per floor of the plan, in build order', () => {
    expect(scene.floorCount).toBe(plan.totalFloors);
    expect(scene.matrices).toBeInstanceOf(Float32Array);
    expect(scene.matrices.length).toBe(plan.totalFloors * 16);
    expect(scene.colors.length).toBe(plan.totalFloors * 3);
    expect(scene.windowColors.length).toBe(plan.totalFloors * 3);
    expect(scene.edges.length).toBe(plan.totalFloors * EDGES_PER_FLOOR * 6);
    expect(scene.edgeColors.length).toBe(scene.edges.length);
  });

  it('colors each floor like its building', () => {
    const [r, g, b] = round(scene.colors.subarray(0, 3), 2);
    const first = plan.buildings[plan.floors[0]?.building ?? 0];
    const hex = first?.color ?? '#000000';
    expect([r, g, b]).toEqual(
      [1, 3, 5].map((i) => Number((parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(2))),
    );
  });

  it('puts every floor inside the ground and under the height limit, over 200 seeds', () => {
    const offenders: string[] = [];
    for (let i = 0; i < 200; i += 1) {
      const p = generateCityPlan(hashString(`scene-${String(i)}`));
      const s = createScenePlan(p);
      for (let f = 0; f < s.floorCount; f += 1) {
        const m = s.matrices.subarray(f * 16, f * 16 + 16);
        const [sx, sy, sz, tx, ty, tz] = [m[0] ?? 0, m[5] ?? 0, m[10] ?? 0, m[12] ?? 0, m[13] ?? 0, m[14] ?? 0];
        const ok =
          Math.abs(tx) + sx / 2 <= p.bounds.width / 2 + 1e-4 &&
          Math.abs(tz) + sz / 2 <= p.bounds.depth / 2 + 1e-4 &&
          ty - sy / 2 >= -1e-4 &&
          ty + sy / 2 <= MAX_BUILDING_FLOORS * FLOOR_HEIGHT + 1e-4;
        if (!ok) offenders.push(`${String(i)}:${String(f)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('anchors a label above each landmark, shown once the building is complete', () => {
    const landmarks = plan.buildings.filter((b) => b.landmark);
    expect(scene.labels.map((l) => l.name)).toEqual(landmarks.map((b) => b.name));
    for (const label of scene.labels) {
      const last = plan.floors.map((f) => f.building).lastIndexOf(label.building);
      expect(label.endFloor).toBe(last + 1);
    }
  });
});

describe('createSceneFrame (CR6.T4)', () => {
  const frameAt = (built: number, lost = 0): ReturnType<typeof createSceneFrame> =>
    createSceneFrame(scene, plan, visibleFloors(plan, built, 600, lost));

  it('is empty when nothing is built', () => {
    expect(frameAt(0)).toEqual({
      instanceCount: 0,
      edgeSegmentCount: 0,
      partial: null,
      labels: [],
    });
  });

  it('counts instances and edges like the visible floors', () => {
    for (const built of [1, 50, 301, 450, 599, 600]) {
      const visible = visibleFloors(plan, built, 600, 0);
      const frame = createSceneFrame(scene, plan, visible);
      const expected = visible.complete + (visible.partialFraction > 0 ? 1 : 0);
      expect(frame.instanceCount).toBe(expected);
      expect(frame.edgeSegmentCount).toBe(expected * EDGES_PER_FLOOR);
    }
  });

  it('shows the whole city at the total, without a partial floor', () => {
    const frame = frameAt(600);
    expect(frame.instanceCount).toBe(plan.totalFloors);
    expect(frame.partial).toBeNull();
    expect(frame.labels.length).toBe(scene.labels.length);
  });

  it('carries the partly paid floor with its own scaled box and the damaged marker', () => {
    const visible = visibleFloors(plan, 301, 600, 0);
    const calm = createSceneFrame(scene, plan, visible);
    expect(calm.partial?.index).toBe(visible.complete);
    expect(calm.partial?.damaged).toBe(false);
    expect(calm.partial?.matrix.length).toBe(16);
    expect(calm.partial?.edges.length).toBe(EDGES_PER_FLOOR * 6);
    const full = scene.matrices[visible.complete * 16 + 5] as number;
    expect(calm.partial?.matrix[5] ?? 0).toBeLessThan(full);

    const hurt = createSceneFrame(scene, plan, visibleFloors(plan, 301, 600, 5));
    expect(hurt.partial?.damaged).toBe(true);
  });

  it('shows a label only when its building is complete', () => {
    const label = scene.labels[0];
    expect(label).toBeDefined();
    const end = label?.endFloor ?? 0;
    const before = createSceneFrame(scene, plan, { complete: end - 1, partialFraction: 0, damaged: false });
    const after = createSceneFrame(scene, plan, { complete: end, partialFraction: 0, damaged: false });
    expect(before.labels).not.toContain(0);
    expect(after.labels).toContain(0);
  });

  it('clamps a visible count beyond the plan', () => {
    const frame = createSceneFrame(scene, plan, { complete: 9_999, partialFraction: 0.5, damaged: false });
    expect(frame.instanceCount).toBe(plan.totalFloors);
    expect(frame.partial).toBeNull();
  });
});

describe('purity (CR6.T4)', () => {
  it('has no clock, randomness, DOM or three.js in the plan folder', () => {
    const dir = resolve(import.meta.dirname, '../../../../../lib/city/plan');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(resolve(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(source).not.toMatch(/Date\.now|Math\.random|from 'three|document\.|window\./);
    }
  });
});

describe('building brightness', () => {
  it('dims the window bands and the edges, so a complete city does not wash out to white', () => {
    expect(WINDOW_BRIGHTNESS).toBeLessThan(1);
    expect(EDGE_BRIGHTNESS).toBeLessThan(1);
    const floor = plan.floors[0];
    const building = plan.buildings[floor?.building ?? -1];
    if (building === undefined) throw new Error('no building');
    const window = hexToUnitRgb(building.windowColor).map((c) => Math.fround(c * WINDOW_BRIGHTNESS));
    const edge = hexToUnitRgb(building.color).map((c) => Math.fround(c * EDGE_BRIGHTNESS));
    expect(Array.from(scene.windowColors.subarray(0, 3))).toEqual(window);
    expect(Array.from(scene.edgeColors.subarray(0, 3))).toEqual(edge);
  });

  it('keeps the bodies at the full palette color (the renderer dims them itself)', () => {
    const building = plan.buildings[plan.floors[0]?.building ?? -1];
    if (building === undefined) throw new Error('no building');
    expect(Array.from(scene.colors.subarray(0, 3))).toEqual(hexToUnitRgb(building.color).map((c) => Math.fround(c)));
  });
});
