import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebGl2 } from '@/components/city/webgl-support';

function docWith(getContext: (kind: string) => unknown): Document {
  return { createElement: () => ({ getContext }) } as unknown as Document;
}

describe('hasWebGl2 (CR6.T8b)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('is true when a webgl2 context can be made, and releases the probe context', () => {
    const loseContext = vi.fn<() => void>();
    const gl = { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) };
    const asked: string[] = [];
    expect(hasWebGl2(docWith((kind) => { asked.push(kind); return gl; }))).toBe(true);
    expect(asked).toEqual(['webgl2']);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('is true even when the browser has no lose-context extension', () => {
    expect(hasWebGl2(docWith(() => ({ getExtension: () => null })))).toBe(true);
  });

  it('is false when there is no webgl2 context', () => {
    expect(hasWebGl2(docWith(() => null))).toBe(false);
  });

  it('is false, and throws nothing, when the probe itself throws', () => {
    expect(hasWebGl2(docWith(() => { throw new Error('blocked'); }))).toBe(false);
  });

  it('is false in a DOM without WebGL (happy-dom)', () => {
    expect(hasWebGl2()).toBe(false);
  });
});
