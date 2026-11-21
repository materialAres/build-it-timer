import { describe, expect, it, vi } from 'vitest';
import { createDebugStats } from '@/components/city/three/debug-stats';

describe('debug stats (CR6.T12)', () => {
  it('writes the frame count and the main-thread time as data attributes', () => {
    const host = document.createElement('div');
    const stats = createDebugStats(host, () => 10);

    stats.onFrame(2);
    stats.onFrame(3.5);

    expect(host.dataset.renderCount).toBe('2');
    expect(host.dataset.renderMs).toBe('5.50');
  });

  it('measures the scene draw calls once there is something to draw, then stops', () => {
    const host = document.createElement('div');
    const measure = vi.fn(() => 10);
    const stats = createDebugStats(host, measure);

    stats.measure();
    stats.measure();
    stats.onFrame(1);

    expect(measure).toHaveBeenCalledTimes(1);
    expect(host.dataset.drawCalls).toBe('10');
  });

  it('keeps trying while the scene is still empty (the first frame can come before the city)', () => {
    const host = document.createElement('div');
    const calls = [0, 0, 11];
    const measure = vi.fn(() => calls.shift() ?? 11);
    const stats = createDebugStats(host, measure);

    stats.measure();
    expect(host.dataset.drawCalls).toBeUndefined();
    stats.measure();
    stats.measure();
    stats.measure();

    expect(host.dataset.drawCalls).toBe('11');
    expect(measure).toHaveBeenCalledTimes(3);
  });

  it('stamps when it was created and when the first frame was drawn', () => {
    const host = document.createElement('div');
    const times = [100, 340.5];
    const stats = createDebugStats(host, () => 1, () => times.shift() ?? 0);

    expect(host.dataset.createdAt).toBe('100.0');
    stats.onFrame(1);
    stats.onFrame(1);

    expect(host.dataset.firstFrameAt).toBe('340.5');
  });

  it('writes nothing until there is something to report', () => {
    const host = document.createElement('div');
    createDebugStats(host, () => 10);
    expect(host.dataset.renderCount).toBeUndefined();
    expect(host.dataset.drawCalls).toBeUndefined();
  });
});
