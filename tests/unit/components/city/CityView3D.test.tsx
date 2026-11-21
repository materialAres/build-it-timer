import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { err, ok } from '@/utils/result';
import { useAppStore } from '@/store';
import { getCityCapture } from '@/components/city/city-capture';
import type { CityRenderer, CityRendererOptions } from '@/components/city/three/city-renderer';

interface FakeRenderer {
  resize: Mock<(w: number, h: number) => void>;
  setScene: Mock<(scene: unknown, plan: unknown) => void>;
  setFrame: Mock<(frame: unknown) => void>;
  setVisible: Mock<(visible: boolean) => void>;
  setReducedMotion: Mock<(reduced: boolean) => void>;
  captureFrame: Mock<(width: number, height: number, format: string) => unknown>;
  dispose: Mock<() => void>;
}
const created = vi.hoisted(() => ({
  options: [] as CityRendererOptions[],
  renderers: [] as FakeRenderer[],
  fail: false,
}));

vi.mock('@/components/city/three/city-renderer', () => ({
  createCityRenderer: (options: CityRendererOptions) => {
    created.options.push(options);
    if (created.fail) return err(new Error('WebGL unavailable'));
    const fake: FakeRenderer = {
      resize: vi.fn<(w: number, h: number) => void>(),
      setScene: vi.fn<(scene: unknown, plan: unknown) => void>(),
      setFrame: vi.fn<(frame: unknown) => void>(),
      setVisible: vi.fn<(visible: boolean) => void>(),
      setReducedMotion: vi.fn<(reduced: boolean) => void>(),
      captureFrame: vi.fn<(width: number, height: number, format: string) => unknown>(() => ok({ dataUrl: 'data:image/png;base64,A' })),
      dispose: vi.fn<() => void>(),
    };
    created.renderers.push(fake);
    return ok(fake as unknown as CityRenderer);
  },
}));

import CityView3D from '@/components/city/CityView3D';

const first = (): FakeRenderer => {
  const found = created.renderers[0];
  if (found === undefined) throw new Error('no renderer');
  return found;
};
function setCity(sessionId: string | null, built: number): void {
  act(() => {
    useAppStore.setState((state) => ({
      city: { ...state.city, sessionId },
      score: { ...state.score, builtCharacters: built },
    }));
  });
}

class FakeObserver {
  static all: FakeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: (entries: Array<{ isIntersecting: boolean }>) => void) { FakeObserver.all.push(this); }
  observe(element: Element): void { this.observed.push(element); }
  disconnect(): void { this.disconnected = true; }
}
class FakeResizeObserver extends FakeObserver {}
class FakeIntersectionObserver extends FakeObserver {}

describe('CityView3D (CR6.T8a)', () => {
  let motionListeners: Array<(event: { matches: boolean }) => void>;
  let reduced: boolean;

  beforeEach(() => {
    created.options.length = 0;
    created.renderers.length = 0;
    created.fail = false;
    FakeObserver.all.length = 0;
    motionListeners = [];
    reduced = false;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return reduced; },
      addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => { motionListeners.push(fn); },
      removeEventListener: (_: string, fn: (event: { matches: boolean }) => void) => {
        motionListeners = motionListeners.filter((l) => l !== fn);
      },
    }));
    setCity('session-view', 0);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('starts one renderer in its host with the look and the ambient layer on', () => {
    const { container } = render(<CityView3D />);
    expect(created.options).toHaveLength(1);
    const options = created.options[0];
    expect(options?.host).toBe(container.querySelector('.city-view'));
    expect(options?.ambient).toBe(true);
    expect(options?.effects).toEqual({ bloom: true, crt: true });
    expect(options?.reducedMotion).toBe(false);
  });

  it('gives the renderer the probed canvas, taken once (#22)', () => {
    const canvas = document.createElement('canvas');
    let taken = false;
    const probe = { take: () => { if (taken) return null; taken = true; return canvas; }, release: () => undefined };
    render(<CityView3D probe={probe} />);
    expect(created.options[0]?.canvas).toBe(canvas);
  });

  it('asks for the free camera only when told to (the full-city page)', () => {
    const { unmount } = render(<CityView3D />);
    expect(created.options[0]?.freeCamera).toBeFalsy();
    unmount();
    render(<CityView3D freeCamera />);
    expect(created.options.at(-1)?.freeCamera).toBe(true);
  });

  it('passes the reduced-motion preference and follows its changes', () => {
    reduced = true;
    render(<CityView3D />);
    expect(created.options[0]?.reducedMotion).toBe(true);
    act(() => { for (const listener of motionListeners) listener({ matches: false }); });
    expect(first().setReducedMotion).toHaveBeenCalledWith(false);
  });

  it('gives the renderer the scene of the plan and the floors standing, and updates them as the city grows', () => {
    setCity('session-view', 300);
    render(<CityView3D />);
    expect(first().setScene).toHaveBeenCalledTimes(1);
    const frame = first().setFrame.mock.calls.at(-1)?.[0] as { instanceCount: number };
    expect(frame.instanceCount).toBeGreaterThan(0);
    setCity('session-view', 450);
    const grown = first().setFrame.mock.calls.at(-1)?.[0] as { instanceCount: number };
    expect(grown.instanceCount).toBeGreaterThan(frame.instanceCount);
    expect(first().setScene).toHaveBeenCalledTimes(1);
  });

  it('replaces the scene when a new session starts, without a new renderer', () => {
    render(<CityView3D />);
    setCity('session-other', 0);
    expect(created.renderers).toHaveLength(1);
    expect(first().setScene).toHaveBeenCalledTimes(2);
  });

  it('fits the host and keeps fitting when it is resized', () => {
    render(<CityView3D />);
    expect(first().resize).toHaveBeenCalled();
    const watcher = FakeObserver.all.find((o) => o instanceof FakeResizeObserver);
    const before = first().resize.mock.calls.length;
    act(() => { watcher?.callback([]); });
    expect(first().resize.mock.calls.length).toBe(before + 1);
  });

  it('tells the renderer when the view leaves and enters the screen', () => {
    render(<CityView3D />);
    const watcher = FakeObserver.all.find((o) => o instanceof FakeIntersectionObserver);
    act(() => { watcher?.callback([{ isIntersecting: false }]); });
    expect(first().setVisible).toHaveBeenLastCalledWith(false);
    act(() => { watcher?.callback([{ isIntersecting: true }]); });
    expect(first().setVisible).toHaveBeenLastCalledWith(true);
  });

  it('offers its renderer as the 3D capture for the export while it runs', () => {
    expect(getCityCapture()).toBeNull();
    render(<CityView3D />);
    const capture = getCityCapture();
    expect(capture).not.toBeNull();
    capture?.(1600, 900, 'png');
    expect(first().captureFrame).toHaveBeenCalledWith(1600, 900, 'png');
  });

  it('withdraws the capture when it goes away', () => {
    const { unmount } = render(<CityView3D />);
    unmount();
    expect(getCityCapture()).toBeNull();
  });

  describe('debug hooks for the e2e (CR6.T12)', () => {
    it('do nothing in a normal run', () => {
      const { container } = render(<CityView3D />);
      expect(created.options[0]?.debug).toBe(false);
      expect(container.querySelector('.city-view')).not.toHaveAttribute('data-plan-hash');
      expect('__buildItCapture' in globalThis).toBe(false);
    });

    it('turn on with ?debug=render: the render counters, the plan fingerprint and a capture hook', () => {
      vi.stubGlobal('location', { search: '?debug=render' });
      const { container, unmount } = render(<CityView3D />);
      expect(created.options[0]?.debug).toBe(true);
      expect(container.querySelector('.city-view')?.getAttribute('data-plan-hash')).toMatch(/^\d+$/);
      const hook = (globalThis as unknown as Record<string, unknown>).__buildItCapture;
      expect(typeof hook).toBe('function');
      unmount();
      expect('__buildItCapture' in globalThis).toBe(false);
    });

    it('give two sessions different fingerprints and one session the same one', () => {
      vi.stubGlobal('location', { search: '?debug=render' });
      const read = (): string | null => document.querySelector('.city-view')?.getAttribute('data-plan-hash') ?? null;
      const { unmount } = render(<CityView3D />);
      const a = read();
      setCity('session-other-city', 0);
      const b = read();
      setCity('session-view', 0);
      const again = read();
      unmount();
      expect(a).not.toBe(b);
      expect(again).toBe(a);
    });
  });

  it('starts no renderer before there is a city', () => {
    setCity(null, 0);
    render(<CityView3D />);
    expect(created.renderers).toHaveLength(0);
  });

  it('cleans up on unmount: disposes the renderer and stops watching', () => {
    const { unmount } = render(<CityView3D />);
    unmount();
    expect(first().dispose).toHaveBeenCalledTimes(1);
    expect(FakeObserver.all.every((o) => o.disconnected)).toBe(true);
    expect(motionListeners).toHaveLength(0);
  });

  it('asks its parent for the fallback, and throws nothing, when WebGL cannot start', () => {
    created.fail = true;
    const onUnavailable = vi.fn<() => void>();
    expect(() => { render(<CityView3D onUnavailable={onUnavailable} />); }).not.toThrow();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('asks for the fallback when the GPU context is lost', () => {
    const onUnavailable = vi.fn<() => void>();
    render(<CityView3D onUnavailable={onUnavailable} />);
    expect(onUnavailable).not.toHaveBeenCalled();
    act(() => { created.options[0]?.onContextLost(); });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('works without a parent callback', () => {
    created.fail = true;
    expect(() => { render(<CityView3D />); }).not.toThrow();
  });
});
