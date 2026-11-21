import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('three', async () => (await import('./three-mock')).threeMock());

import type { SceneLabel } from '@/lib/city/plan/scene-data';
import { createCityLabels } from '@/components/city/three/city-labels';
import { attr, made, only, resetMade, type Geo } from './three-mock';

const labels: SceneLabel[] = [
  { building: 1, name: 'NEXUS', position: [1, 4, 2], endFloor: 10 },
  { building: 2, name: 'VANTA', position: [-3, 5, 0], endFloor: 20 },
];

function stubCanvas(available: boolean): Mock<(text: string) => void> {
  const fillText = vi.fn<(text: string) => void>();
  const context = { font: '', fillStyle: '', textBaseline: '', fillText, measureText: () => ({ width: 100 }) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => (available ? context : null)) as never);
  return fillText;
}

describe('createCityLabels (CR6.T7)', () => {
  beforeEach(resetMade);
  afterEach(() => { vi.restoreAllMocks(); });

  it('has no labels when there is nothing to name or no 2D canvas', () => {
    stubCanvas(true);
    expect(createCityLabels([])).toBeNull();
    stubCanvas(false);
    expect(createCityLabels(labels)).toBeNull();
  });

  it('draws every name once as "> NAME" into one texture and one mesh', () => {
    const fillText = stubCanvas(true);
    createCityLabels(labels);
    expect(fillText.mock.calls.map((c) => c[0])).toEqual(['> NEXUS', '> VANTA']);
    expect(made.textures).toHaveLength(1);
    expect(made.objects.filter((o) => o.kind === 'mesh')).toHaveLength(1);
  });

  it('shows only the labels it is told to, by index', () => {
    stubCanvas(true);
    const result = createCityLabels(labels);
    const geometry = only('mesh').geometry as Geo;
    expect(geometry.drawRange.count).toBe(0);
    result?.show([1]);
    expect(geometry.drawRange.count).toBe(6);
    expect(Array.from(geometry.index?.array.subarray(0, 6) ?? [])).toEqual([4, 5, 6, 4, 6, 7]);
    result?.show([0, 1]);
    expect(geometry.drawRange.count).toBe(12);
    result?.show([]);
    expect(geometry.drawRange.count).toBe(0);
  });

  it('turns every label to face the camera, standing on its anchor', () => {
    stubCanvas(true);
    const result = createCityLabels(labels);
    result?.orient([1, 0, 0], [0, 1, 0]);
    const positions = Array.from(attr(only('mesh').geometry, 'position').array);
    const [blx, bly, blz, brx, bry, brz, , try_] = positions;
    expect(bly).toBe(4);
    expect(bry).toBe(4);
    expect(blz).toBe(2);
    expect(brz).toBe(2);
    expect(((blx ?? 0) + (brx ?? 0)) / 2).toBeCloseTo(1, 6);
    expect(try_).toBeGreaterThan(4);
    result?.orient([0, 0, 1], [0, 1, 0]);
    const turned = Array.from(attr(only('mesh').geometry, 'position').array);
    expect(turned[0]).toBe(1);
    expect(turned[2]).not.toBe(turned[5]);
  });

  it('frees its geometry, material and texture', () => {
    stubCanvas(true);
    const result = createCityLabels(labels);
    result?.dispose();
    expect(only('mesh').geometry?.disposed).toBe(1);
    expect(only('mesh').material?.disposed).toBe(1);
    expect(made.textures[0]?.disposed).toBe(1);
  });
});
