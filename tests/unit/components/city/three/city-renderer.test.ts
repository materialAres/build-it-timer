import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { hashString } from '@/utils/hash';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { createSceneFrame, createScenePlan } from '@/lib/city/plan/scene-data';
import { visibleFloors } from '@/lib/city/plan/visible-floors';

const mocks = vi.hoisted(() => {
  const log = {
    rendererOptions: [] as Array<Record<string, unknown>>,
    pixelRatios: [] as number[],
    sizes: [] as Array<[number, number]>,
    renders: 0,
    disposed: [] as string[],
    controlsListeners: new Map<string, () => void>(),
    failConstruct: false,
    lastControls: null as Record<string, unknown> | null,
    fx: [] as Array<{ options: unknown; render: Mock<() => void>; resize: Mock<(w: number, h: number) => void>; setCrt: Mock<(on: boolean) => void>; dispose: Mock<() => void> }>,
    meshes: [] as Array<{
      group: unknown;
      animating: boolean;
      setFrame: Mock<(f: unknown, now: number) => void>;
      update: Mock<(now: number) => void>;
      orient: Mock<(right: unknown, up: unknown) => void>;
      setReducedMotion: Mock<(reduced: boolean) => void>;
      dispose: Mock<() => void>;
      input: unknown;
    }>,
  };
  return log;
});

vi.mock('three', () => {
  class WebGLRenderer {
    domElement: HTMLCanvasElement = document.createElement('canvas');
    constructor(options: Record<string, unknown>) {
      if (mocks.failConstruct) throw new Error('WebGL unavailable');
      mocks.rendererOptions.push(options);
    }
    setPixelRatio(ratio: number): void { mocks.pixelRatios.push(ratio); }
    getPixelRatio(): number { return mocks.pixelRatios.at(-1) ?? 1; }
    setSize(w: number, h: number): void { mocks.sizes.push([w, h]); }
    setClearColor(): void {}
    render(): void { mocks.renders += 1; }
    dispose(): void { mocks.disposed.push('renderer'); }
    forceContextLoss(): void { mocks.disposed.push('context'); }
  }
  class Scene {
    children: unknown[] = [];
    add(child: unknown): void { this.children.push(child); }
    remove(child: unknown): void { this.children = this.children.filter((c) => c !== child); }
    traverse(fn: (o: unknown) => void): void { for (const c of this.children) fn(c); }
  }
  class OrthographicCamera {
    position = { set: vi.fn(), x: 0, y: 0, z: 0, copy: vi.fn() };
    zoom = 1;
    left = 0; right = 0; top = 0; bottom = 0;
    matrixWorld = { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
    lookAt(): void {}
    updateMatrixWorld(): void {}
    updateProjectionMatrix(): void {}
  }
  class Color { constructor(public value?: unknown) {} }
  return { WebGLRenderer, Scene, OrthographicCamera, Color, Vector3: class { constructor(public x = 0, public y = 0, public z = 0) {} } };
});

vi.mock('three/addons/controls/OrbitControls.js', () => {
  class OrbitControls {
    enablePan = true; enableDamping = true; enableZoom = true;
    minZoom = 0; maxZoom = 0; minPolarAngle = 0; maxPolarAngle = 0; minAzimuthAngle = 0; maxAzimuthAngle = 0;
    target = { set: vi.fn(), x: 0, y: 0, z: 0 };
    constructor() { mocks.lastControls = this as unknown as Record<string, unknown>; }
    addEventListener(type: string, fn: () => void): void { mocks.controlsListeners.set(type, fn); }
    removeEventListener(type: string): void { mocks.controlsListeners.delete(type); }
    update(): void {}
    dispose(): void { mocks.disposed.push('controls'); }
  }
  return { OrbitControls };
});

vi.mock('@/components/city/three/post-processing', () => ({
  createPostProcessing: (_gl: unknown, options: unknown) => {
    const fx = {
      options,
      render: vi.fn(() => { mocks.renders += 1; }),
      resize: vi.fn<(w: number, h: number) => void>(),
      setCrt: vi.fn<(on: boolean) => void>(),
      dispose: vi.fn<() => void>(),
    };
    mocks.fx.push(fx);
    return fx;
  },
}));
vi.mock('@/components/city/three/city-scene', () => ({
  createCityScene: (input: unknown) => {
    const m = {
      group: { id: `group-${String(mocks.meshes.length)}` },
      animating: false,
      setFrame: vi.fn<(f: unknown, now: number) => void>(),
      update: vi.fn<(now: number) => void>(),
      orient: vi.fn<(right: unknown, up: unknown) => void>(),
      setReducedMotion: vi.fn<(reduced: boolean) => void>(),
      dispose: vi.fn<() => void>(),
      input,
    };
    mocks.meshes.push(m);
    return m;
  },
}));

import { FREE_ORBIT_LIMITS, ORBIT_LIMITS } from '@/lib/city/camera-framing';
import { createCityRenderer } from '@/components/city/three/city-renderer';
import type { CityRenderer, CityRendererOptions } from '@/components/city/three/city-renderer';

/** A manual frame clock: callbacks run only when the test says so. */
function createFrameClock() {
  let next = 1;
  const pending = new Map<number, (t: number) => void>();
  return {
    request: (cb: (t: number) => void): number => {
      const id = next;
      next += 1;
      pending.set(id, cb);
      return id;
    },
    cancel: (id: number): void => { pending.delete(id); },
    /** Run every pending callback once at `time`; returns how many ran. */
    flush(time: number): number {
      const batch = [...pending.entries()];
      pending.clear();
      for (const [, cb] of batch) cb(time);
      return batch.length;
    },
    get size(): number { return pending.size; },
  };
}

describe('createCityRenderer (CR6.T6a)', () => {
  let host: HTMLElement;
  let clock: ReturnType<typeof createFrameClock>;
  let time: number;
  let lost: Mock<() => void>;
  let created: CityRenderer[];

  function create(overrides: Partial<CityRendererOptions> = {}): CityRenderer {
    const result = createCityRenderer({
      host,
      onContextLost: lost,
      reducedMotion: false,
      ambient: false,
      now: () => time,
      frames: clock,
      ...overrides,
    });
    if (!result.ok) throw result.error;
    created.push(result.value);
    return result.value;
  }

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    clock = createFrameClock();
    time = 1_000;
    lost = vi.fn<() => void>();
    created = [];
    mocks.rendererOptions.length = 0;
    mocks.pixelRatios.length = 0;
    mocks.sizes.length = 0;
    mocks.renders = 0;
    mocks.disposed.length = 0;
    mocks.controlsListeners.clear();
    mocks.failConstruct = false;
    mocks.lastControls = null;
    mocks.fx.length = 0;
    mocks.meshes.length = 0;
    vi.stubGlobal('devicePixelRatio', 1);
  });

  afterEach(() => {
    for (const r of created) r.dispose();
    host.remove();
    vi.unstubAllGlobals();
  });

  describe('creation', () => {
    it('is light: no MSAA, low-power GPU, no preserved drawing buffer', () => {
      create();
      expect(mocks.rendererOptions[0]).toMatchObject({
        antialias: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: false,
      });
    });

    it.each([[1, 1], [1.25, 1.25], [2, 1.5], [3, 1.5]])('caps the pixel ratio: device %s → %s', (device, expected) => {
      vi.stubGlobal('devicePixelRatio', device);
      create();
      expect(mocks.pixelRatios.at(-1)).toBe(expected);
    });

    it('puts one canvas in the host', () => {
      create();
      expect(host.querySelectorAll('canvas')).toHaveLength(1);
    });

    it('returns an error, never throws, when WebGL is unavailable', () => {
      mocks.failConstruct = true;
      const result = createCityRenderer({
        host, onContextLost: lost, reducedMotion: false, ambient: false, now: () => time, frames: clock,
      });
      expect(result.ok).toBe(false);
      expect(host.querySelectorAll('canvas')).toHaveLength(0);
    });
  });

  describe('frames on demand', () => {
    it('draws the first frame, then nothing while nothing changes', () => {
      create();
      clock.flush(1_000);
      expect(mocks.renders).toBe(1);
      expect(clock.size).toBe(0);
      expect(clock.flush(2_000)).toBe(0);
      expect(mocks.renders).toBe(1);
    });

    it('draws one frame when the floors change', () => {
      const r = create();
      clock.flush(1_000);
      r.invalidate('floors');
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
      clock.flush(1_200);
      expect(mocks.renders).toBe(2);
    });

    it('merges changes made before the next frame into one draw', () => {
      const r = create();
      clock.flush(1_000);
      r.invalidate('floors');
      r.invalidate('floors');
      r.invalidate('camera');
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
    });

    it('draws when the camera moves (orbit controls change)', () => {
      create();
      clock.flush(1_000);
      mocks.controlsListeners.get('change')?.();
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
    });

    it('resizes the canvas and the camera, and draws', () => {
      const r = create();
      clock.flush(1_000);
      r.resize(400, 300);
      expect(mocks.sizes.at(-1)).toEqual([400, 300]);
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
    });

    it('ignores a resize to an unusable size', () => {
      const r = create();
      clock.flush(1_000);
      r.resize(0, 300);
      r.resize(Number.NaN, 300);
      expect(clock.flush(1_100)).toBe(0);
      expect(mocks.renders).toBe(1);
    });

    it('counts its renders for the e2e probe', () => {
      const r = create();
      clock.flush(1_000);
      r.invalidate('floors');
      clock.flush(1_100);
      expect(r.renderCount).toBe(2);
    });
  });

  describe('visibility and motion', () => {
    it('draws nothing while hidden and the pending change when shown again', () => {
      const r = create();
      r.setVisible(false);
      r.invalidate('floors');
      clock.flush(1_000);
      expect(mocks.renders).toBe(0);
      r.setVisible(true);
      clock.flush(1_100);
      expect(mocks.renders).toBe(1);
    });

    it('stops while the document is hidden', () => {
      const r = create();
      clock.flush(1_000);
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      r.invalidate('floors');
      clock.flush(1_100);
      expect(mocks.renders).toBe(1);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      clock.flush(1_200);
      expect(mocks.renders).toBe(2);
    });

    it('runs an ambient layer at most 30 times a second', () => {
      create({ ambient: true });
      let frames = 0;
      for (let t = 0; t < 1_000; t += 4) {
        time = t;
        frames += clock.flush(t) > 0 ? 1 : 0;
      }
      expect(mocks.renders).toBeLessThanOrEqual(30);
      expect(mocks.renders).toBeGreaterThanOrEqual(25);
      expect(frames).toBeGreaterThan(0);
    });

    it('draws no ambient frame under reduced motion', () => {
      create({ ambient: true, reducedMotion: true });
      clock.flush(1_000);
      expect(mocks.renders).toBe(1);
      clock.flush(1_500);
      expect(mocks.renders).toBe(1);
    });

    it('follows a change of the reduced-motion preference', () => {
      const r = create({ ambient: true, reducedMotion: true });
      clock.flush(1_000);
      r.setReducedMotion(false);
      time = 1_100;
      clock.flush(1_100);
      time = 1_200;
      clock.flush(1_200);
      expect(mocks.renders).toBeGreaterThan(1);
    });
  });

  describe('limited orbit controls', () => {
    it('allows no pan and no damping, only a bounded orbit and zoom', () => {
      create();
      expect(mocks.lastControls).toMatchObject({
        enablePan: false,
        enableDamping: false,
        minPolarAngle: ORBIT_LIMITS.minPolar,
        maxPolarAngle: ORBIT_LIMITS.maxPolar,
        minAzimuthAngle: ORBIT_LIMITS.minAzimuth,
        maxAzimuthAngle: ORBIT_LIMITS.maxAzimuth,
        minZoom: ORBIT_LIMITS.minZoom,
        maxZoom: ORBIT_LIMITS.maxZoom,
      });
    });
  });

  describe('free camera (CR6.T11)', () => {
    it('turns all the way round and may pan, still without damping', () => {
      create({ freeCamera: true });
      expect(mocks.lastControls).toMatchObject({
        enablePan: true,
        enableDamping: false,
        minPolarAngle: FREE_ORBIT_LIMITS.minPolar,
        maxPolarAngle: FREE_ORBIT_LIMITS.maxPolar,
        minAzimuthAngle: -Infinity,
        maxAzimuthAngle: Infinity,
        minZoom: FREE_ORBIT_LIMITS.minZoom,
        maxZoom: FREE_ORBIT_LIMITS.maxZoom,
      });
    });

    it('is the limited camera unless asked', () => {
      create();
      expect(mocks.lastControls).toMatchObject({ enablePan: false, maxAzimuthAngle: ORBIT_LIMITS.maxAzimuth });
    });
  });

  describe('context loss', () => {
    it('reports a lost context to the caller and stops drawing', () => {
      create();
      clock.flush(1_000);
      const canvas = host.querySelector('canvas');
      const event = new Event('webglcontextlost', { cancelable: true });
      canvas?.dispatchEvent(event);
      expect(lost).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('dispose', () => {
    it('frees the renderer, the context and the controls, and removes the canvas', () => {
      const r = create();
      r.dispose();
      expect(mocks.disposed).toEqual(expect.arrayContaining(['renderer', 'context', 'controls']));
      expect(host.querySelectorAll('canvas')).toHaveLength(0);
    });

    it('cancels the pending frame and draws nothing afterwards', () => {
      const r = create();
      r.dispose();
      expect(clock.size).toBe(0);
      r.invalidate('floors');
      clock.flush(2_000);
      expect(mocks.renders).toBe(0);
    });

    it('removes its listeners', () => {
      const r = create();
      const canvas = host.querySelector('canvas');
      r.dispose();
      expect(mocks.controlsListeners.has('change')).toBe(false);
      canvas?.dispatchEvent(new Event('webglcontextlost'));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(lost).not.toHaveBeenCalled();
    });

    it('is safe to call twice', () => {
      const r = create();
      r.dispose();
      expect(() => { r.dispose(); }).not.toThrow();
      expect(mocks.disposed.filter((d) => d === 'renderer')).toHaveLength(1);
    });

    it('runs the cleanups other modules registered', () => {
      const r = create();
      const cleanup = vi.fn();
      r.registerDisposable(cleanup);
      r.dispose();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });


  describe('scene and effects (CR6.T6b)', () => {
    const plan = generateCityPlan(hashString('session-renderer'));
    const scene = createScenePlan(plan);
    const frame = (built: number) => createSceneFrame(scene, plan, visibleFloors(plan, built, 600, 0));

    it('has no post-processing unless asked: a plain render', () => {
      create();
      expect(mocks.fx).toHaveLength(0);
    });

    it('draws through the post-processing composer when asked', () => {
      create({ effects: { bloom: true, crt: true } });
      clock.flush(1_000);
      expect(mocks.fx[0]?.options).toEqual({ bloom: true, crt: true });
      expect(mocks.fx[0]?.render).toHaveBeenCalledTimes(1);
      expect(mocks.renders).toBe(1);
    });

    it('resizes the composer with the canvas', () => {
      const r = create({ effects: { bloom: true, crt: true } });
      r.resize(400, 300);
      expect(mocks.fx[0]?.resize).toHaveBeenCalledWith(400, 300);
    });

    it('switches the CRT pass on and off', () => {
      const r = create({ effects: { bloom: true, crt: true } });
      clock.flush(1_000);
      r.setCrt(false);
      expect(mocks.fx[0]?.setCrt).toHaveBeenCalledWith(false);
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
    });

    it('adds the city meshes to the scene and draws them', () => {
      const r = create();
      clock.flush(1_000);
      r.setScene(scene, plan);
      expect(mocks.meshes).toHaveLength(1);
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
    });

    it('gives the visible floors to the meshes and draws one frame for the change', () => {
      const r = create();
      r.setScene(scene, plan);
      clock.flush(1_000);
      const f = frame(300);
      r.setFrame(f);
      expect(mocks.meshes[0]?.setFrame).toHaveBeenCalledWith(f, time);
      clock.flush(1_100);
      expect(mocks.renders).toBe(2);
      clock.flush(1_200);
      expect(mocks.renders).toBe(2);
    });

    it('ignores a frame that arrives before any scene', () => {
      const r = create();
      clock.flush(1_000);
      expect(() => { r.setFrame(frame(300)); }).not.toThrow();
      expect(clock.flush(1_100)).toBe(0);
    });

    it('applies the last frame to a scene that is set afterwards', () => {
      const r = create();
      r.setFrame(frame(300));
      r.setScene(scene, plan);
      expect(mocks.meshes[0]?.setFrame).toHaveBeenCalledWith(frame(300), time);
    });

    it('frees the previous meshes when the scene is replaced', () => {
      const r = create();
      r.setScene(scene, plan);
      r.setScene(scene, plan);
      expect(mocks.meshes[0]?.dispose).toHaveBeenCalledTimes(1);
      expect(mocks.meshes).toHaveLength(2);
    });

    it('frees the meshes and the composer on dispose', () => {
      const r = create({ effects: { bloom: true, crt: true } });
      r.setScene(scene, plan);
      r.dispose();
      expect(mocks.meshes[0]?.dispose).toHaveBeenCalledTimes(1);
      expect(mocks.fx[0]?.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ambient layer and animations (CR6.T7)', () => {
    const plan = generateCityPlan(hashString('session-motion'));
    const scene = createScenePlan(plan);
    const frame = (built: number) => createSceneFrame(scene, plan, visibleFloors(plan, built, 600, 0));
    const city = () => {
      const found = mocks.meshes[0];
      if (found === undefined) throw new Error('no scene');
      return found;
    };

    it('tells the scene whether an ambient layer exists and whether motion is reduced', () => {
      const r = create({ ambient: true, reducedMotion: true });
      r.setScene(scene, plan);
      expect(city().input).toMatchObject({ ambient: true, reducedMotion: true });
    });

    it('advances the scene to the frame time just before drawing, and turns the labels to the camera', () => {
      const r = create();
      r.setScene(scene, plan);
      clock.flush(1_000);
      expect(city().update).toHaveBeenCalledWith(time);
      expect(city().orient).toHaveBeenCalledWith([1, 0, 0], [0, 1, 0]);
      expect(city().update).toHaveBeenCalledTimes(mocks.renders);
    });

    it('keeps asking for frames while a floor animation runs, then stops', () => {
      const r = create();
      r.setScene(scene, plan);
      r.setFrame(frame(100));
      clock.flush(1_000);
      expect(clock.size).toBe(0);
      city().animating = true;
      r.invalidate('floors');
      clock.flush(1_016);
      expect(clock.size).toBe(1);
      clock.flush(1_032);
      expect(mocks.renders).toBeGreaterThanOrEqual(3);
      city().animating = false;
      clock.flush(1_048);
      expect(clock.size).toBe(0);
    });

    it('draws no animation frame under reduced motion', () => {
      const r = create({ reducedMotion: true });
      r.setScene(scene, plan);
      clock.flush(1_000);
      city().animating = true;
      r.invalidate('floors');
      clock.flush(1_016);
      expect(clock.size).toBe(0);
    });

    it('hands a change of the reduced-motion preference to the scene and draws the settled picture', () => {
      const r = create();
      r.setScene(scene, plan);
      clock.flush(1_000);
      const before = mocks.renders;
      r.setReducedMotion(true);
      expect(city().setReducedMotion).toHaveBeenCalledWith(true);
      clock.flush(1_100);
      expect(mocks.renders).toBe(before + 1);
    });
  });

  describe('capture (CR6.T10)', () => {
    const plan = generateCityPlan(hashString('session-capture'));
    const scene = createScenePlan(plan);

    function withCanvas(r: CityRenderer): void {
      const canvas = host.querySelector('canvas');
      if (canvas === null) throw new Error('no canvas');
      canvas.toDataURL = ((type: string) => `data:${type};base64,AAAA`);
      r.setScene(scene, plan);
    }

    it('renders one frame at the requested size and returns it as an image', () => {
      const r = create({ effects: { bloom: true, crt: true } });
      r.resize(480, 272);
      withCanvas(r);
      clock.flush(1_000);
      const rendersBefore = mocks.renders;
      const result = r.captureFrame(1600, 900, 'png');

      expect(result).toEqual({
        ok: true,
        value: { dataUrl: 'data:image/png;base64,AAAA', mimeType: 'image/png', width: 1600, height: 900 },
      });
      expect(mocks.sizes).toContainEqual([1600, 900]);
      expect(mocks.renders).toBe(rendersBefore + 1);
      expect(mocks.fx[0]?.resize).toHaveBeenCalledWith(1600, 900);
    });

    it('is exactly as large as asked: the pixel ratio is 1 while it renders and back afterwards', () => {
      vi.stubGlobal('devicePixelRatio', 2);
      const r = create();
      r.resize(480, 272);
      withCanvas(r);
      const before = mocks.pixelRatios.length;
      r.captureFrame(800, 450, 'jpeg');
      expect(mocks.pixelRatios.slice(before)).toEqual([1, 1.5]);
      vi.unstubAllGlobals();
    });

    it('puts the view back and draws it again, and does not count as a rendered frame of the view', () => {
      const r = create();
      r.resize(480, 272);
      withCanvas(r);
      clock.flush(1_000);
      const frames = r.renderCount;
      r.captureFrame(800, 450, 'png');
      expect(mocks.sizes.at(-1)).toEqual([480, 272]);
      expect(r.renderCount).toBe(frames);
      const rendersBefore = mocks.renders;
      clock.flush(1_100);
      expect(mocks.renders).toBe(rendersBefore + 1);
    });

    it('returns an error for an unusable size without rendering', () => {
      const r = create();
      withCanvas(r);
      const rendersBefore = mocks.renders;
      expect(r.captureFrame(0, 900, 'png').ok).toBe(false);
      expect(mocks.renders).toBe(rendersBefore);
    });

    it('returns an error after the context is lost or the renderer is disposed', () => {
      const r = create();
      withCanvas(r);
      host.querySelector('canvas')?.dispatchEvent(new Event('webglcontextlost'));
      expect(r.captureFrame(800, 450, 'png').ok).toBe(false);
      const other = create();
      other.dispose();
      expect(other.captureFrame(800, 450, 'png').ok).toBe(false);
    });
  });

  it('has no extension API and no store access (§1.3)', () => {
    const dir = resolve(import.meta.dirname, '../../../../../components/city/three');
    for (const name of readdirSync(dir)) {
      const source = readFileSync(resolve(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(source).not.toMatch(/\b(chrome|browser)\.|from '@\/store|useAppStore|wxt\//);
    }
  });
});
