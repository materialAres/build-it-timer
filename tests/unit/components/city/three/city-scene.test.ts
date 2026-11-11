import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => (await import('./three-mock')).threeMock());

import { hashString } from '@/utils/hash';
import { DROP_MS, GLITCH_MS } from '@/lib/city/floor-motion';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { createSceneFrame, createScenePlan } from '@/lib/city/plan/scene-data';
import { createCityScene } from '@/components/city/three/city-scene';
import { ofKind, resetMade, type Obj } from './three-mock';

const plan = generateCityPlan(hashString('session-city-scene'));
const scene = createScenePlan(plan);
const frameFor = (floors: number) =>
  createSceneFrame(scene, plan, { complete: floors, partialFraction: 0, damaged: false });
const make = (overrides: Partial<{ ambient: boolean; reducedMotion: boolean }> = {}) =>
  createCityScene({ scene, plan, ambient: true, reducedMotion: false, ...overrides });
const bodies = (): Obj => ofKind('instanced')[0] as Obj;

describe('createCityScene (CR6.T7)', () => {
  beforeEach(() => {
    resetMade();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stays within the draw-call budget for the whole city (≤ 12)', () => {
    const city = make();
    let drawables = 0;
    city.group.traverse((o) => {
      if (['mesh', 'instanced', 'lines', 'points', 'grid'].includes((o as unknown as Obj).kind)) drawables += 1;
    });
    expect(drawables).toBeLessThanOrEqual(12);
    expect(drawables).toBe(10);
  });

  it('does not animate on first paint, then drops each new floor in and comes to rest', () => {
    const city = make();
    city.setFrame(frameFor(100), 0);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(100);
    city.setFrame(frameFor(120), 1000);
    expect(city.animating).toBe(true);
    city.update(1000 + DROP_MS / 2);
    expect(city.animating).toBe(true);
    city.update(1000 + DROP_MS);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(120);
  });

  it('keeps removed floors on screen while they glitch out, then they are gone', () => {
    const city = make();
    city.setFrame(frameFor(200), 0);
    city.setFrame(frameFor(150), 1000);
    city.update(1000);
    expect(bodies().count).toBe(200);
    city.update(1000 + GLITCH_MS);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(150);
  });

  it('shows growth and removal as static changes under reduced motion', () => {
    const city = make({ reducedMotion: true });
    city.setFrame(frameFor(100), 0);
    city.setFrame(frameFor(130), 1000);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(130);
    city.setFrame(frameFor(90), 2000);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(90);
  });

  it('has no ambient motion under reduced motion, and the preference can change while running', () => {
    const city = make({ reducedMotion: true });
    const [rain, cars] = [ofKind('lines')[1] as Obj, ofKind('instanced')[3] as Obj];
    expect(rain.visible).toBe(false);
    expect(cars.visible).toBe(false);
    city.setReducedMotion(false);
    expect(rain.visible).toBe(true);
    city.setReducedMotion(true);
    expect(rain.visible).toBe(false);
  });

  it('has no ambient layer motion at all when none was asked for', () => {
    make({ ambient: false });
    expect((ofKind('lines')[1] as Obj).visible).toBe(false);
  });

  it('finishes a running animation when reduced motion is turned on', () => {
    const city = make();
    city.setFrame(frameFor(100), 0);
    city.setFrame(frameFor(60), 1000);
    expect(city.animating).toBe(true);
    city.setReducedMotion(true);
    expect(city.animating).toBe(false);
    expect(bodies().count).toBe(60);
  });

  it('draws the same final picture after a burst of malus removals as without animation', () => {
    const animated = make();
    const still = make({ reducedMotion: true });
    animated.setFrame(frameFor(250), 0);
    still.setFrame(frameFor(250), 0);
    let now = 0;
    for (let floors = 249; floors >= 180; floors -= 3) {
      now += 15;
      animated.setFrame(frameFor(floors), now);
      animated.update(now);
    }
    still.setFrame(frameFor(180), now);
    animated.update(now + 10_000);
    const a = ofKind('instanced')[0];
    const b = ofKind('instanced')[4];
    expect(a?.count).toBe(b?.count);
    expect(Array.from(a?.instanceMatrix?.array ?? [])).toEqual(Array.from(b?.instanceMatrix?.array ?? []));
  });

  it('frees everything on dispose', () => {
    const city = make();
    city.dispose();
    for (const o of ofKind('lines')) expect(o.geometry?.disposed).toBeGreaterThan(0);
  });
});
