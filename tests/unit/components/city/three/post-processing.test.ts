import { beforeEach, describe, expect, it, vi } from 'vitest';

interface PassLike {
  kind: string;
  disposed: number;
  enabled?: boolean;
  shader?: unknown;
  sizes?: Array<[number, number]>;
  /** Only a bloom pass has these. */
  strength?: number;
  radius?: number;
  threshold?: number;
}
interface ComposerLike {
  passes: PassLike[];
  sizes: Array<[number, number]>;
  rendered: number;
  disposed: number;
}
const fx = vi.hoisted(() => ({
  composers: [] as ComposerLike[],
  blooms: [] as PassLike[],
  shaders: [] as PassLike[],
  order: [] as string[],
}));

vi.mock('three', () => ({
  Vector2: class { constructor(public x = 0, public y = 0) {} },
}));
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    passes: PassLike[] = [];
    sizes: Array<[number, number]> = [];
    ratio = 0;
    rendered = 0;
    disposed = 0;
    constructor(public renderer: unknown) { fx.composers.push(this); }
    addPass(p: PassLike): void { this.passes.push(p); fx.order.push(p.kind); }
    setSize(w: number, h: number): void { this.sizes.push([w, h]); }
    setPixelRatio(r: number): void { this.ratio = r; }
    render(): void { this.rendered += 1; }
    dispose(): void { this.disposed += 1; }
  },
}));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
  RenderPass: class { kind = 'render'; disposed = 0; constructor(public scene: unknown, public camera: unknown) {} dispose(): void { this.disposed += 1; } },
}));
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: class {
    kind = 'bloom'; enabled = true; disposed = 0; sizes: Array<[number, number]> = [];
    constructor(public resolution: { x: number; y: number }, public strength: number, public radius: number, public threshold: number) { fx.blooms.push(this); }
    setSize(w: number, h: number): void { this.sizes.push([w, h]); }
    dispose(): void { this.disposed += 1; }
  },
}));
vi.mock('three/addons/postprocessing/ShaderPass.js', () => ({
  ShaderPass: class {
    kind = 'crt'; enabled = true; disposed = 0;
    constructor(public shader: unknown) { fx.shaders.push(this); }
    dispose(): void { this.disposed += 1; }
  },
}));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({
  OutputPass: class { kind = 'output'; disposed = 0; dispose(): void { this.disposed += 1; } },
}));

import { createPostProcessing } from '@/components/city/three/post-processing';
import { CRT_SHADER } from '@/components/city/three/crt-pass';

const gl = { renderer: { id: 'r' }, scene: { id: 's' }, camera: { id: 'c' } } as never;

function at<T>(items: ReadonlyArray<T>, index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing item ${String(index)}`);
  return item;
}

describe('createPostProcessing (CR6.T6b)', () => {
  beforeEach(() => {
    fx.composers.length = 0;
    fx.blooms.length = 0;
    fx.shaders.length = 0;
    fx.order.length = 0;
  });

  it('renders the scene, blooms it, applies the CRT look, then converts to the screen', () => {
    createPostProcessing(gl, { bloom: true, crt: true });
    expect(fx.order).toEqual(['render', 'bloom', 'crt', 'output']);
  });

  it('keeps the bloom subtle so the buildings stay recognizable (I011)', () => {
    createPostProcessing(gl, { bloom: true, crt: true });
    const bloom = at(fx.blooms);
    // 0.9 / 0.5 / 0.15 added up over thousands of bright edges and blew the whole city out to white.
    expect(bloom.strength ?? Infinity).toBeLessThanOrEqual(0.4);
    expect(bloom.radius ?? Infinity).toBeLessThanOrEqual(0.3);
    expect(bloom.threshold ?? 0).toBeGreaterThanOrEqual(0.45);
  });

  it('draws through the composer', () => {
    const post = createPostProcessing(gl, { bloom: true, crt: true });
    post.render();
    expect(at(fx.composers).rendered).toBe(1);
  });

  it('runs the bloom at half resolution, also after a resize', () => {
    const post = createPostProcessing(gl, { bloom: true, crt: true });
    post.resize(400, 300);
    expect(at(fx.composers).sizes.at(-1)).toEqual([400, 300]);
    expect(at(fx.blooms).sizes?.at(-1)).toEqual([200, 150]);
    post.resize(401, 301);
    expect(at(fx.blooms).sizes?.at(-1)).toEqual([201, 151]);
  });

  it('has no bloom pass when bloom is off', () => {
    createPostProcessing(gl, { bloom: false, crt: true });
    expect(fx.order).toEqual(['render', 'crt', 'output']);
  });

  it('uses the CRT shader and can switch it off and on without other changes', () => {
    const post = createPostProcessing(gl, { bloom: true, crt: true });
    expect(at(fx.shaders).shader).toBe(CRT_SHADER);
    post.setCrt(false);
    expect(at(fx.shaders).enabled).toBe(false);
    expect(fx.order).toEqual(['render', 'bloom', 'crt', 'output']);
    post.setCrt(true);
    expect(at(fx.shaders).enabled).toBe(true);
  });

  it('starts with the CRT pass off when asked', () => {
    createPostProcessing(gl, { bloom: true, crt: false });
    expect(at(fx.shaders).enabled).toBe(false);
  });

  it('frees the composer and every pass, once', () => {
    const post = createPostProcessing(gl, { bloom: true, crt: true });
    post.dispose();
    post.dispose();
    const composer = at(fx.composers);
    expect(composer.disposed).toBe(1);
    for (const pass of composer.passes) expect(pass.disposed).toBe(1);
  });

  it('ignores a resize to an unusable size', () => {
    const post = createPostProcessing(gl, { bloom: true, crt: true });
    post.resize(0, 100);
    post.resize(Number.NaN, 100);
    expect(at(fx.composers).sizes).toEqual([]);
  });
});
