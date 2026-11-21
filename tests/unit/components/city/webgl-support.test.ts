import { afterEach, describe, expect, it, vi } from 'vitest';
import { GL_ATTRIBUTES, afterFirstPaint, probeWebGl2 } from '@/components/city/webgl-support';

function docWith(getContext: (kind: string, attributes?: unknown) => unknown): { doc: Document; canvas: { getContext: typeof getContext } } {
  const canvas = { getContext };
  return { doc: { createElement: () => canvas } as unknown as Document, canvas };
}

describe('probeWebGl2 (CR6.T8b, open issue #22)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('makes the webgl2 context once, with the renderer attributes, and hands its canvas over', () => {
    const asked: Array<[string, unknown]> = [];
    const { doc, canvas } = docWith((kind, attributes) => { asked.push([kind, attributes]); return { getExtension: () => null }; });
    const probe = probeWebGl2(doc);
    expect(asked).toEqual([['webgl2', GL_ATTRIBUTES]]);
    expect(probe?.take()).toBe(canvas);
    expect(probe?.take()).toBeNull();
  });

  it('releases the context only when nobody took the canvas', () => {
    const loseContext = vi.fn<() => void>();
    const gl = { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) };
    const unused = probeWebGl2(docWith(() => gl).doc);
    unused?.release();
    unused?.release();
    expect(loseContext).toHaveBeenCalledTimes(1);

    const used = probeWebGl2(docWith(() => gl).doc);
    used?.take();
    used?.release();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('is null when there is no webgl2 context, or the probe throws', () => {
    expect(probeWebGl2(docWith(() => null).doc)).toBeNull();
    expect(probeWebGl2(docWith(() => { throw new Error('blocked'); }).doc)).toBeNull();
  });

  it('is null in a DOM without WebGL (happy-dom)', () => {
    expect(probeWebGl2()).toBeNull();
  });
});

describe('afterFirstPaint', () => {
  it('runs the work after the next frame and a task, and can be cancelled', () => {
    vi.useFakeTimers();
    const frames: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const work = vi.fn<() => void>();
    afterFirstPaint(work);
    expect(work).not.toHaveBeenCalled();
    frames.shift()?.();
    expect(work).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(work).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn<() => void>();
    const cancel = afterFirstPaint(cancelled);
    cancel();
    frames.shift()?.();
    vi.runAllTimers();
    expect(cancelled).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
