import { describe, expect, it } from 'vitest';
import {
  DROP_HEIGHT,
  DROP_MS,
  GLITCH_MS,
  MAX_ANIMATED_FLOORS,
  advanceMotion,
  crackLevel,
  createMotionState,
  displayCount,
  dropOffset,
  glitchLevel,
  glitchShift,
  isMoving,
  pruneMotion,
} from '@/lib/city/floor-motion';

const start = (target: number) => advanceMotion(createMotionState(), target, 0);

describe('floor motion timeline (CR6.T7)', () => {
  it('does not animate on first paint', () => {
    const state = start(40);
    expect(isMoving(state)).toBe(false);
    expect(displayCount(state)).toBe(40);
  });

  it('drops in each new floor', () => {
    const state = advanceMotion(start(10), 12, 1000);
    expect(state.drops.map((e) => e.slot)).toEqual([10, 11]);
    expect(isMoving(state)).toBe(true);
  });

  it('keeps a removed floor on screen while it glitches out', () => {
    const state = advanceMotion(start(10), 7, 1000);
    expect(state.glitches.map((e) => e.slot)).toEqual([7, 8, 9]);
    expect(displayCount(state)).toBe(10);
    expect(state.target).toBe(7);
  });

  it('ends in the rest state once the time has passed', () => {
    const state = pruneMotion(advanceMotion(advanceMotion(start(10), 12, 1000), 5, 1100), 1100 + GLITCH_MS + DROP_MS);
    expect(isMoving(state)).toBe(false);
    expect(displayCount(state)).toBe(5);
  });

  it('survives a burst of removals: the final count is exactly the target', () => {
    let state = start(200);
    let now = 0;
    for (let built = 199; built >= 120; built -= 1) {
      now += 10;
      state = advanceMotion(state, built, now);
      expect(displayCount(state)).toBeGreaterThanOrEqual(built);
    }
    state = pruneMotion(state, now + 10_000);
    expect(isMoving(state)).toBe(false);
    expect(displayCount(state)).toBe(120);
  });

  it('animates at most a bounded number of floors per change', () => {
    const grow = advanceMotion(start(0), 100, 5);
    expect(grow.drops).toHaveLength(MAX_ANIMATED_FLOORS);
    const shrink = advanceMotion(start(100), 0, 5);
    expect(shrink.glitches).toHaveLength(MAX_ANIMATED_FLOORS);
  });

  it('stops glitching a floor that grows back and drops one that is removed', () => {
    const removed = advanceMotion(start(10), 7, 100);
    const regrown = advanceMotion(removed, 9, 150);
    expect(regrown.glitches.map((e) => e.slot)).toEqual([9]);
    const grown = advanceMotion(start(10), 12, 100);
    const cut = advanceMotion(grown, 10, 120);
    expect(cut.drops).toEqual([]);
  });

  it('is a no-op when the count does not change', () => {
    const state = start(10);
    expect(advanceMotion(state, 10, 50)).toEqual(state);
  });
});

describe('floor motion levels (CR6.T7)', () => {
  it('drops from above and lands exactly in place', () => {
    expect(dropOffset(0)).toBeCloseTo(DROP_HEIGHT, 9);
    expect(dropOffset(DROP_MS)).toBe(0);
    expect(dropOffset(DROP_MS * 10)).toBe(0);
    expect(dropOffset(-5)).toBeCloseTo(DROP_HEIGHT, 9);
    const samples = [0, 60, 120, 180, 240, 300, 360].map(dropOffset);
    for (let i = 1; i < samples.length; i += 1) expect(samples[i] ?? 0).toBeLessThanOrEqual(samples[i - 1] ?? 0);
  });

  it('glitches in red with blink-outs and is dark when over', () => {
    const levels = Array.from({ length: 8 }, (_, i) => glitchLevel(i * 40));
    expect(levels[0]).toBe(1);
    expect(levels).toContain(0);
    expect(glitchLevel(GLITCH_MS)).toBe(0);
    expect(glitchLevel(GLITCH_MS + 500)).toBe(0);
    for (const level of levels) expect(level).toBeGreaterThanOrEqual(0);
  });

  it('shakes a glitching floor only a little', () => {
    for (let age = 0; age < GLITCH_MS; age += 10) expect(Math.abs(glitchShift(3, age))).toBeLessThanOrEqual(0.07);
  });

  it('flickers a damaged floor within 0.15 and 1, and repeats', () => {
    const levels = Array.from({ length: 170 }, (_, i) => crackLevel(i * 10));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.15);
    expect(Math.max(...levels)).toBe(1);
    expect(new Set(levels).size).toBeGreaterThan(2);
    expect(crackLevel(-100)).toBeGreaterThan(0);
  });
});
