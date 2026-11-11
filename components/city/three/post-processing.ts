import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { GlContext } from './renderer-context';
import { CRT_SHADER } from './crt-pass';

export interface PostProcessingOptions {
  readonly bloom: boolean;
  readonly crt: boolean;
}

export interface PostProcessing {
  render(): void;
  /** Size in CSS pixels; the bloom always runs at half of it. */
  resize(width: number, height: number): void;
  /** The CRT look on or off, with nothing else changing. */
  setCrt(enabled: boolean): void;
  dispose(): void;
}

const BLOOM = { strength: 0.9, radius: 0.5, threshold: 0.15 } as const;

interface Disposable {
  dispose(): void;
}

/**
 * Bloom at half resolution, then the CRT pass, then the conversion to the
 * screen (CR6.T6b). The composer draws everything: the renderer shell calls
 * `render()` instead of rendering the scene directly when effects are on.
 */
export function createPostProcessing(
  gl: Pick<GlContext, 'renderer' | 'scene' | 'camera'>,
  options: PostProcessingOptions,
): PostProcessing {
  const composer = new EffectComposer(gl.renderer);
  const passes: Disposable[] = [];
  const add = <T extends Disposable>(pass: T): T => {
    composer.addPass(pass as never);
    passes.push(pass);
    return pass;
  };

  add(new RenderPass(gl.scene, gl.camera));
  const bloom = options.bloom
    ? add(new UnrealBloomPass(new Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold))
    : null;
  const crt = add(new ShaderPass(CRT_SHADER));
  crt.enabled = options.crt;
  add(new OutputPass());

  let disposed = false;
  return {
    render: () => { composer.render(); },
    resize(width, height): void {
      if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return;
      composer.setSize(width, height);
      bloom?.setSize(Math.ceil(width / 2), Math.ceil(height / 2));
    },
    setCrt(enabled): void { crt.enabled = enabled; },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const pass of passes) pass.dispose();
      composer.dispose();
    },
  };
}
