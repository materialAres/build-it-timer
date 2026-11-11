import { err, ok, type Result } from '@/utils/result';
import {
  createSchedulerState,
  decideFrame,
  frameDrawn,
  invalidate,
  needsLoop,
  type DirtyReason,
  type SchedulerInput,
} from '@/lib/city/render-scheduler';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import type { SceneFrame, ScenePlan } from '@/lib/city/plan/scene-data';
import { createCityScene, type CityScene } from './city-scene';
import { createPostProcessing, type PostProcessing, type PostProcessingOptions } from './post-processing';
import { applyFraming, cameraAxes, createGlContext, disposeScene, type GlContext } from './renderer-context';

/** A source of animation frames, injectable so tests drive time by hand. */
export interface FrameSource {
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}

export interface CityRendererOptions {
  /** The element the canvas is added to. */
  readonly host: HTMLElement;
  /** Called once when the GPU context is lost, so the view can fall back. */
  readonly onContextLost: () => void;
  readonly reducedMotion: boolean;
  /** Whether an ambient layer exists (CR6.T7); false draws only real changes. */
  readonly ambient: boolean;
  /** Bloom and the CRT look; omitted means a plain render (no post-processing). */
  readonly effects?: PostProcessingOptions;
  readonly now?: () => number;
  readonly frames?: FrameSource;
}

export interface CityRenderer {
  /** Frames drawn so far (the e2e probe reads it to prove "0 renders when idle"). */
  readonly renderCount: number;
  /** Fit the canvas and the camera to a size in CSS pixels; unusable sizes are ignored. */
  resize(width: number, height: number): void;
  /** Something that changes the picture happened; one frame will be drawn for it. */
  invalidate(reason: DirtyReason): void;
  /** Whether the view is on screen (its tab is open); a hidden view draws nothing. */
  setVisible(visible: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  /** Replace the city: build its meshes from the plan's scene data and add them. */
  setScene(scene: ScenePlan, plan: CityPlan): void;
  /** Show the floors of a frame (a plan and the progress, already derived) and draw once. */
  setFrame(frame: SceneFrame): void;
  /** The CRT look on or off; nothing else changes. */
  setCrt(enabled: boolean): void;
  /** Register a cleanup (render targets, composer passes) to run on `dispose()`. */
  registerDisposable(cleanup: () => void): void;
  /** Free every GPU resource and listener; safe to call twice. */
  dispose(): void;
}

const browserFrames: FrameSource = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => { cancelAnimationFrame(id); },
};

/**
 * The framework-free renderer shell (CR6.T6a): it starts, resizes, stops and
 * cleans up, and draws a frame only when `lib/city/render-scheduler.ts` says
 * one is due. It never touches `chrome.*`/`browser.*` or the store (§1.3): the
 * view above it feeds it sizes, visibility and "the floors changed".
 * Returns an error, never throws, when WebGL cannot start.
 */
export function createCityRenderer(options: CityRendererOptions): Result<CityRenderer> {
  let gl: GlContext;
  try {
    gl = createGlContext(options.host);
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error('WebGL could not start'));
  }
  return ok(wireRenderer(gl, options));
}

function wireRenderer(gl: GlContext, options: CityRendererOptions): CityRenderer {
  const now = options.now ?? ((): number => performance.now());
  const frames = options.frames ?? browserFrames;
  const canvas = gl.renderer.domElement;
  const cleanups: Array<() => void> = [];
  let state = invalidate(createSchedulerState(), 'floors');
  let frameId: number | null = null;
  let renderCount = 0;
  let hostVisible = true;
  let reducedMotion = options.reducedMotion;
  let disposed = false;
  let lost = false;
  const post: PostProcessing | null = options.effects ? createPostProcessing(gl, options.effects) : null;
  let city: CityScene | null = null;
  let lastFrame: SceneFrame | null = null;

  const input = (): SchedulerInput => ({
    now: now(),
    visible: hostVisible && !document.hidden,
    reducedMotion,
    ambient: options.ambient,
    animating: city?.animating ?? false,
  });
  const pump = (): void => {
    if (disposed || lost || frameId !== null || !needsLoop(state, input())) return;
    frameId = frames.request(onFrame);
  };
  function onFrame(): void {
    frameId = null;
    if (disposed || lost) return;
    const current = input();
    const decision = decideFrame(state, current);
    if (decision.draw) {
      city?.update(current.now);
      if (city) city.orient(...cameraAxes(gl.camera));
      if (post) post.render();
      else gl.renderer.render(gl.scene, gl.camera);
      renderCount += 1;
      state = frameDrawn(state, decision, current.now);
    }
    pump();
  }
  const change = (reason: DirtyReason): void => {
    state = invalidate(state, reason);
    pump();
  };

  const onCameraMoved = (): void => { change('camera'); };
  const onVisibilityChange = (): void => { pump(); };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
    options.onContextLost();
  };
  gl.controls.addEventListener('change', onCameraMoved);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', onContextLost);
  pump();

  return {
    get renderCount(): number { return renderCount; },
    resize(width, height): void {
      if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) return;
      gl.renderer.setSize(width, height);
      applyFraming(gl.camera, width, height);
      post?.resize(width, height);
      change('resize');
    },
    setScene(scene, plan): void {
      if (disposed) return;
      if (city) {
        gl.scene.remove(city.group);
        city.dispose();
      }
      city = createCityScene({ scene, plan, ambient: options.ambient, reducedMotion });
      gl.scene.add(city.group);
      if (lastFrame) city.setFrame(lastFrame, now());
      change('floors');
    },
    setFrame(frame): void {
      lastFrame = frame;
      if (disposed || city === null) return;
      city.setFrame(frame, now());
      change('floors');
    },
    setCrt(enabled): void {
      post?.setCrt(enabled);
      change('look');
    },
    invalidate: change,
    setVisible(visible): void {
      hostVisible = visible;
      pump();
    },
    setReducedMotion(value): void {
      reducedMotion = value;
      city?.setReducedMotion(value);
      change('floors');
    },
    registerDisposable(cleanup): void { cleanups.push(cleanup); },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (frameId !== null) frames.cancel(frameId);
      gl.controls.removeEventListener('change', onCameraMoved);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      for (const cleanup of cleanups.reverse()) cleanup();
      city?.dispose();
      post?.dispose();
      gl.controls.dispose();
      disposeScene(gl.scene);
      gl.renderer.dispose();
      gl.renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
