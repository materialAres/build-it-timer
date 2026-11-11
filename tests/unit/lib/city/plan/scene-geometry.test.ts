import { describe, expect, it } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { createScenePlan } from '@/lib/city/plan/scene-data';
import {
  BAND_HEIGHT_RATIO,
  BAND_OUTSET,
  labelQuad,
  roadVertices,
  scaleColors,
  windowBandMatrices,
} from '@/lib/city/plan/scene-geometry';
import { FLOOR_HEIGHT } from '@/lib/city/plan/limits';

const plan = generateCityPlan(hashString('session-geometry'));
const scene = createScenePlan(plan);

describe('windowBandMatrices (CR6.T6b)', () => {
  const bands = windowBandMatrices(scene.matrices);

  it('has one band per floor instance', () => {
    expect(bands).toBeInstanceOf(Float32Array);
    expect(bands.length).toBe(scene.matrices.length);
  });

  it('keeps each floor center and makes a thin band slightly wider than the body', () => {
    for (const i of [0, 7, scene.floorCount - 1]) {
      const m = scene.matrices.subarray(i * 16, i * 16 + 16);
      const b = bands.subarray(i * 16, i * 16 + 16);
      expect([b[12], b[13], b[14]]).toEqual([m[12], m[13], m[14]]);
      expect(b[0]).toBeCloseTo((m[0] ?? 0) * (1 + BAND_OUTSET), 5);
      expect(b[10]).toBeCloseTo((m[10] ?? 0) * (1 + BAND_OUTSET), 5);
      expect(b[5]).toBeCloseTo((m[5] ?? 0) * BAND_HEIGHT_RATIO, 5);
      expect(b[15]).toBe(1);
    }
  });

  it('stays inside the floor it belongs to', () => {
    for (let i = 0; i < scene.floorCount; i += 1) {
      const m = scene.matrices.subarray(i * 16, i * 16 + 16);
      const b = bands.subarray(i * 16, i * 16 + 16);
      const bandTop = (b[13] ?? 0) + (b[5] ?? 0) / 2;
      const floorTop = (m[13] ?? 0) + (m[5] ?? 0) / 2;
      expect(bandTop).toBeLessThanOrEqual(floorTop + 1e-5);
    }
  });

  it('does not touch its input', () => {
    const before = Array.from(scene.matrices);
    windowBandMatrices(scene.matrices);
    expect(Array.from(scene.matrices)).toEqual(before);
  });

  it('is empty for an empty input', () => {
    expect(windowBandMatrices(new Float32Array(0)).length).toBe(0);
  });
});

describe('roadVertices (CR6.T6b)', () => {
  it('makes two triangles (18 floats) per road segment', () => {
    expect(roadVertices(plan).length).toBe(plan.roads.length * 18);
  });

  it('lies flat just above the floor, centered on the origin', () => {
    const v = roadVertices(plan);
    for (let i = 0; i < v.length; i += 3) {
      expect(v[i + 1]).toBeGreaterThan(0);
      expect(v[i + 1]).toBeLessThan(FLOOR_HEIGHT / 4);
      expect(Math.abs(v[i] ?? 0)).toBeLessThanOrEqual(plan.bounds.width / 2);
      expect(Math.abs(v[i + 2] ?? 0)).toBeLessThanOrEqual(plan.bounds.depth / 2);
    }
  });

  it('covers exactly the area of the roads', () => {
    const v = roadVertices(plan);
    let area = 0;
    const at = (i: number): number => v[i] ?? 0;
    for (let i = 0; i < v.length; i += 9) {
      const [ax, az, bx, bz, cx, cz] = [at(i), at(i + 2), at(i + 3), at(i + 5), at(i + 6), at(i + 8)];
      area += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    const cells = plan.roads.reduce((sum, r) => sum + r.w * r.d, 0);
    expect(area).toBeCloseTo(cells, 5);
  });
});

describe('scaleColors (CR6.T6b)', () => {
  it('scales every channel and returns a new array', () => {
    const colors = new Float32Array([1, 0.5, 0.25]);
    const dim = scaleColors(colors, 0.5);
    expect(Array.from(dim)).toEqual([0.5, 0.25, 0.125]);
    expect(Array.from(colors)).toEqual([1, 0.5, 0.25]);
  });
});

describe('labelQuad (CR6.T7)', () => {
  it('stands on its anchor and spreads along the camera axes', () => {
    const quad = labelQuad([2, 5, 3], 2, 0.5, [1, 0, 0], [0, 1, 0]);
    expect(quad).toEqual([1, 5, 3, 3, 5, 3, 3, 5.5, 3, 1, 5.5, 3]);
  });

  it('turns with the camera: a right axis along z spreads the quad along z', () => {
    const quad = labelQuad([0, 1, 0], 4, 1, [0, 0, 1], [0, 1, 0]);
    expect(quad.slice(0, 3)).toEqual([0, 1, -2]);
    expect(quad.slice(3, 6)).toEqual([0, 1, 2]);
  });
});
