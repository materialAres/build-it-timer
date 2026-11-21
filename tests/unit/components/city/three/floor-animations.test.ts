import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DROP_HEIGHT, DROP_MS, GLITCH_MS, crackLevel } from '@/lib/city/floor-motion';
import type { PartialFloor, SceneFrame } from '@/lib/city/plan/scene-data';
import type { SlotLook, SlotWriter } from '@/components/city/three/floor-slots';
import { createFloorAnimations, type FloorAnimations } from '@/components/city/three/floor-animations';

const partialAt = (index: number, damaged: boolean): PartialFloor => ({
  index, fraction: 0.5, damaged, matrix: new Float32Array(16), edges: new Float32Array(72),
});
const frame = (count: number, partial: PartialFloor | null = null): SceneFrame => ({
  instanceCount: count, edgeSegmentCount: count * 12, partial, labels: [],
});

interface Harness {
  animations: FloorAnimations;
  draws: Array<{ slot: number; look: SlotLook | undefined }>;
  counts: number[];
  lastLook: (slot: number) => SlotLook | undefined;
}

function harness(): Harness {
  const draws: Harness['draws'] = [];
  const counts: number[] = [];
  const slots: SlotWriter = {
    draw: (slot, look) => { draws.push({ slot, look }); },
    setWindows: vi.fn(),
  };
  const animations = createFloorAnimations({ slots, setVisibleCount: (n) => { counts.push(n); } });
  return {
    animations, draws, counts,
    lastLook: (slot) => draws.filter((d) => d.slot === slot).at(-1)?.look,
  };
}

describe('floor animations (CR6.T7)', () => {
  let h: Harness;
  beforeEach(() => { h = harness(); });

  it('does not animate on first paint', () => {
    h.animations.setFrame(frame(40), 0);
    expect(h.animations.active).toBe(false);
    h.animations.update(10, false);
    expect(h.draws).toEqual([]);
  });

  it('drops a new floor in from above and lets it land exactly in place', () => {
    h.animations.setFrame(frame(10), 0);
    h.animations.setFrame(frame(11), 1000);
    expect(h.animations.active).toBe(true);
    h.animations.update(1000, false);
    expect(h.lastLook(10)?.shift?.[1]).toBeCloseTo(DROP_HEIGHT, 6);
    h.animations.update(1000 + DROP_MS / 2, false);
    const midway = h.lastLook(10)?.shift?.[1] ?? 0;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(DROP_HEIGHT);
    h.animations.update(1000 + DROP_MS, false);
    expect(h.lastLook(10)?.shift).toEqual([0, 0, 0]);
    expect(h.animations.active).toBe(false);
    expect(h.counts.at(-1)).toBe(11);
  });

  it('keeps a removed floor drawn while it glitches out in red, then removes it', () => {
    h.animations.setFrame(frame(10), 0);
    h.animations.setFrame(frame(8), 1000);
    h.animations.update(1000, false);
    expect(h.counts.at(-1)).toBe(10);
    expect(h.lastLook(9)?.glitch).toBeGreaterThan(0);
    h.animations.update(1000 + GLITCH_MS, false);
    expect(h.counts.at(-1)).toBe(8);
    expect(h.lastLook(9)?.glitch).toBeUndefined();
    expect(h.animations.active).toBe(false);
  });

  it('ends a burst of removals at rest: every floor back to its static data', () => {
    h.animations.setFrame(frame(100), 0);
    let now = 0;
    for (let count = 99; count >= 60; count -= 1) {
      now += 8;
      h.animations.setFrame(frame(count), now);
      h.animations.update(now, false);
      expect(h.counts.at(-1)).toBeGreaterThanOrEqual(count);
    }
    h.animations.update(now + 5000, false);
    expect(h.animations.active).toBe(false);
    expect(h.counts.at(-1)).toBe(60);
    const touched = new Set(h.draws.map((d) => d.slot));
    for (const slot of touched) {
      const look = h.lastLook(slot);
      expect(look?.glitch).toBeUndefined();
      expect(look?.shift?.every((v) => v === 0)).toBe(true);
    }
  });

  it('restores a floor whose animation ended while no frame was drawn', () => {
    h.animations.setFrame(frame(10), 0);
    h.animations.setFrame(frame(8), 1000);
    h.animations.update(1000, false);
    expect(h.lastLook(9)?.glitch).toBeGreaterThan(0);
    // The next change arrives long after the glitch ended: the old entries are pruned on arrival.
    h.animations.setFrame(frame(30), 5000);
    h.animations.update(5000, false);
    expect(h.lastLook(9)?.glitch).toBeUndefined();
    expect(h.lastLook(8)?.glitch).toBeUndefined();
  });

  it('flickers a damaged top floor on ambient ticks only', () => {
    const damaged = partialAt(20, true);
    h.animations.setFrame(frame(21, damaged), 0);
    h.animations.update(100, false);
    expect(h.draws).toEqual([]);
    h.animations.update(100, true);
    expect(h.lastLook(20)?.partial).toBe(damaged);
    expect(h.lastLook(20)?.glow).toBe(crackLevel(100));
    const seen = new Set<number | undefined>();
    for (let t = 0; t < 1700; t += 30) {
      h.animations.update(t, true);
      seen.add(h.lastLook(20)?.glow);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('does not flicker a healthy partial floor', () => {
    h.animations.setFrame(frame(21, partialAt(20, false)), 0);
    h.animations.update(100, true);
    expect(h.draws).toEqual([]);
  });

  it('shows the damaged floor steady red when the flicker is turned off', () => {
    h.animations.setFrame(frame(21, partialAt(20, true)), 0);
    h.animations.update(100, true);
    h.animations.setFlicker(false);
    expect(h.lastLook(20)?.glow).toBe(1);
    const drawn = h.draws.length;
    h.animations.update(200, true);
    expect(h.draws).toHaveLength(drawn);
  });

  it('shows growth and removal as static changes when disabled (reduced motion)', () => {
    h.animations.setEnabled(false);
    h.animations.setFrame(frame(10), 0);
    h.animations.setFrame(frame(14), 100);
    h.animations.setFrame(frame(5), 200);
    expect(h.animations.active).toBe(false);
    h.animations.update(210, true);
    expect(h.draws).toEqual([]);
  });

  it('finishes a running animation at once when disabled', () => {
    h.animations.setFrame(frame(10), 0);
    h.animations.setFrame(frame(6), 1000);
    h.animations.update(1000, false);
    h.animations.setEnabled(false);
    expect(h.animations.active).toBe(false);
    expect(h.counts.at(-1)).toBe(6);
    expect(h.lastLook(9)?.glitch).toBeUndefined();
  });
});
