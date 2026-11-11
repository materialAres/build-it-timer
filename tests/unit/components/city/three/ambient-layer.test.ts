import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => (await import('./three-mock')).threeMock());

import { hashString } from '@/utils/hash';
import { createAmbientPlan } from '@/lib/city/ambient-plan';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { AMBIENT_INTERVAL_MS } from '@/lib/city/render-scheduler';
import { createAmbientLayer } from '@/components/city/three/ambient-layer';
import { attr, made, ofKind, resetMade, type Obj } from './three-mock';

const plan = generateCityPlan(hashString('session-ambient'));
const ambientPlan = createAmbientPlan(plan);

function setup(): { layer: ReturnType<typeof createAmbientLayer>; windows: Array<[number, number]> } {
  const windows: Array<[number, number]> = [];
  const layer = createAmbientLayer({ plan, setWindows: (slot, level) => { windows.push([slot, level]); } });
  return { layer, windows };
}
const [rainLines] = [() => ofKind('lines')[0] as Obj];
const cars = (): Obj => ofKind('instanced')[1] as Obj;
const signs = (): Obj => ofKind('instanced')[0] as Obj;
const lights = (): Obj => ofKind('points')[0] as Obj;
const sum = (a: ArrayLike<number>): number => Array.from(a).reduce((s, v) => s + v, 0);
const lastFloorOf = (building: number): number =>
  plan.floors.reduce((end, f, i) => (f.building === building ? i + 1 : end), 0);

describe('createAmbientLayer (CR6.T7)', () => {
  beforeEach(resetMade);

  it('is four draw calls: lights, signs, rain and cars', () => {
    const { layer } = setup();
    let drawables = 0;
    layer.group.traverse((o) => { if (['points', 'instanced', 'lines'].includes((o as unknown as Obj).kind)) drawables += 1; });
    expect(drawables).toBe(4);
  });

  it('shows lamps from the start and beacons and signs only once their building is complete', () => {
    const { layer } = setup();
    const colors = attr(lights().geometry, 'color').array;
    const lampCount = plan.props.filter((p) => p.kind === 'lamp').length;
    const lit = (): number => Array.from({ length: colors.length / 3 }, (_, i) => sum(Array.from(colors).slice(i * 3, i * 3 + 3))).filter((v) => v > 0).length;
    expect(lit()).toBe(lampCount);
    expect(signs().count).toBe(0);
    layer.setComplete(plan.totalFloors);
    expect(signs().count).toBe(plan.props.filter((p) => p.kind === 'sign').length);
    layer.update(1000);
    expect(lit()).toBe(plan.props.filter((p) => p.kind !== 'sign').length);
  });

  it('shows a sign exactly when its building is complete', () => {
    const { layer } = setup();
    const sign = plan.props.find((p) => p.kind === 'sign' && p.building !== null);
    if (sign?.building == null) return;
    const end = lastFloorOf(sign.building);
    layer.setComplete(end - 1);
    const before = signs().count ?? 0;
    layer.setComplete(end);
    expect(signs().count).toBeGreaterThan(before);
  });

  it('updates at most 30 times a second', () => {
    const { layer } = setup();
    expect(layer.update(1000)).toBe(true);
    expect(layer.update(1000 + AMBIENT_INTERVAL_MS / 2)).toBe(false);
    expect(layer.update(1000 + AMBIENT_INTERVAL_MS + 0.01)).toBe(true);
  });

  it('moves the rain and the cars between updates', () => {
    const { layer } = setup();
    layer.update(1000);
    const rain = Array.from(attr(rainLines().geometry, 'position').array);
    const car = Array.from((cars().instanceMatrix as { array: Float32Array }).array);
    layer.update(1500);
    expect(Array.from(attr(rainLines().geometry, 'position').array)).not.toEqual(rain);
    expect(Array.from((cars().instanceMatrix as { array: Float32Array }).array)).not.toEqual(car);
    expect(cars().count).toBe(ambientPlan.cars.length);
  });

  it('flickers only the windows of its plan, never going dark for good', () => {
    const { layer, windows } = setup();
    for (let t = 1000; t < 9000; t += 40) layer.update(t);
    const floors = new Set(ambientPlan.flickers.map((f) => f.floor));
    expect(windows.every(([slot]) => floors.has(slot))).toBe(true);
    const levels = windows.map(([, level]) => level);
    expect(Math.min(...levels)).toBeLessThan(0.7);
    expect(levels.filter((l) => l === 1).length).toBeGreaterThan(levels.length / 2);
  });

  it('pulses the beacons while the motion is on', () => {
    const { layer } = setup();
    layer.setComplete(plan.totalFloors);
    const beaconCount = plan.props.filter((p) => p.kind === 'beacon').length;
    if (beaconCount === 0) return;
    layer.update(1000);
    const a = Array.from(attr(lights().geometry, 'color').array);
    layer.update(1700);
    expect(Array.from(attr(lights().geometry, 'color').array)).not.toEqual(a);
  });

  it('stops the motion on request: no rain, no cars, steady beacons, windows back to normal', () => {
    const { layer, windows } = setup();
    layer.setComplete(plan.totalFloors);
    layer.update(1000);
    layer.setMotion(false);
    expect(rainLines().visible).toBe(false);
    expect(cars().visible).toBe(false);
    expect(layer.update(5000)).toBe(false);
    const restored = windows.slice(-ambientPlan.flickers.length);
    expect(restored.every(([, level]) => level === 1)).toBe(true);
    const colors = Array.from(attr(lights().geometry, 'color').array);
    layer.update(9000);
    expect(Array.from(attr(lights().geometry, 'color').array)).toEqual(colors);
    layer.setMotion(true);
    expect(rainLines().visible).toBe(true);
    expect(layer.update(9000)).toBe(true);
  });

  it('is built the same way for the same plan', () => {
    setup();
    const first = Array.from(attr(rainLines().geometry, 'position').array);
    resetMade();
    setup();
    expect(Array.from(attr(rainLines().geometry, 'position').array)).toEqual(first);
    expect(made.objects.length).toBeGreaterThan(0);
  });

  it('frees its geometry and materials', () => {
    const { layer } = setup();
    layer.dispose();
    for (const o of made.objects.filter((x) => x.geometry !== undefined)) expect(o.geometry?.disposed).toBeGreaterThan(0);
  });
});
