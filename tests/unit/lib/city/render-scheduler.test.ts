import { describe, expect, it } from 'vitest';
import {
  AMBIENT_INTERVAL_MS,
  createSchedulerState,
  decideFrame,
  frameDrawn,
  invalidate,
  needsLoop,
  type SchedulerInput,
} from '@/lib/city/render-scheduler';

const input = (overrides: Partial<SchedulerInput> = {}): SchedulerInput => ({
  now: 1_000,
  visible: true,
  reducedMotion: false,
  ambient: false,
  ...overrides,
});

describe('render scheduler (CR6.T6a)', () => {
  it('draws nothing when nothing changed', () => {
    expect(decideFrame(createSchedulerState(), input())).toEqual({ draw: false, reasons: [] });
  });

  it.each(['floors', 'camera', 'resize'] as const)('draws one frame when %s changed', (reason) => {
    const state = invalidate(createSchedulerState(), reason);
    expect(decideFrame(state, input())).toEqual({ draw: true, reasons: [reason] });
  });

  it('lists every pending reason once', () => {
    let state = createSchedulerState();
    state = invalidate(state, 'floors');
    state = invalidate(state, 'resize');
    state = invalidate(state, 'floors');
    expect(decideFrame(state, input()).reasons).toEqual(['floors', 'resize']);
  });

  it('clears the pending reasons once the frame is drawn', () => {
    const state = invalidate(createSchedulerState(), 'floors');
    const drawn = frameDrawn(state, decideFrame(state, input()), 1_000);
    expect(decideFrame(drawn, input({ now: 1_001 }))).toEqual({ draw: false, reasons: [] });
  });

  it('does not mutate the state it is given', () => {
    const state = createSchedulerState();
    invalidate(state, 'floors');
    expect(state.pending).toEqual([]);
  });

  describe('ambient frames', () => {
    it('are due on the first look when enabled', () => {
      expect(decideFrame(createSchedulerState(), input({ ambient: true }))).toEqual({
        draw: true,
        reasons: ['ambient'],
      });
    });

    it('are not due again before the 30 fps interval has passed', () => {
      const first = decideFrame(createSchedulerState(), input({ ambient: true, now: 1_000 }));
      const state = frameDrawn(createSchedulerState(), first, 1_000);
      const early = decideFrame(state, input({ ambient: true, now: 1_000 + AMBIENT_INTERVAL_MS - 1 }));
      expect(early.draw).toBe(false);
    });

    it('are due again once the interval has passed, never above 30 fps', () => {
      let state = createSchedulerState();
      let frames = 0;
      for (let now = 0; now < 1_000; now += 4) {
        const decision = decideFrame(state, input({ ambient: true, now }));
        if (decision.draw) {
          frames += 1;
          state = frameDrawn(state, decision, now);
        }
      }
      expect(frames).toBeLessThanOrEqual(30);
      expect(frames).toBeGreaterThanOrEqual(28);
    });

    it('are off under reduced motion', () => {
      expect(
        decideFrame(createSchedulerState(), input({ ambient: true, reducedMotion: true })),
      ).toEqual({ draw: false, reasons: [] });
    });

    it('still draw a real change under reduced motion', () => {
      const state = invalidate(createSchedulerState(), 'floors');
      expect(decideFrame(state, input({ ambient: true, reducedMotion: true })).reasons).toEqual([
        'floors',
      ]);
    });

    it('a change frame also counts as the ambient frame (no double draw)', () => {
      const state = invalidate(createSchedulerState(), 'floors');
      const decision = decideFrame(state, input({ ambient: true, now: 5_000 }));
      const next = frameDrawn(state, decision, 5_000);
      expect(decideFrame(next, input({ ambient: true, now: 5_001 })).draw).toBe(false);
    });
  });

  describe('when the view is hidden', () => {
    it('draws nothing, not even a pending change or an ambient frame', () => {
      const state = invalidate(createSchedulerState(), 'floors');
      expect(decideFrame(state, input({ visible: false, ambient: true }))).toEqual({
        draw: false,
        reasons: [],
      });
    });

    it('keeps the change pending and draws it once visible again', () => {
      const state = invalidate(createSchedulerState(), 'camera');
      expect(decideFrame(state, input({ visible: false })).draw).toBe(false);
      expect(decideFrame(state, input({ visible: true })).reasons).toEqual(['camera']);
    });
  });

  describe('needsLoop', () => {
    it('is false when idle: no frame callbacks are requested at all', () => {
      expect(needsLoop(createSchedulerState(), input())).toBe(false);
    });

    it('is true with a pending change while visible', () => {
      expect(needsLoop(invalidate(createSchedulerState(), 'resize'), input())).toBe(true);
    });

    it('is true for the ambient layer while visible and motion is allowed', () => {
      expect(needsLoop(createSchedulerState(), input({ ambient: true }))).toBe(true);
      expect(needsLoop(createSchedulerState(), input({ ambient: true, reducedMotion: true }))).toBe(false);
    });

    it('is false while hidden, whatever is pending', () => {
      const state = invalidate(createSchedulerState(), 'floors');
      expect(needsLoop(state, input({ visible: false, ambient: true }))).toBe(false);
    });
  });
});
