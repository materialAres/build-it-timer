import type { Result } from '@/utils/result';
import type { RasterizedCityImage, ImageFormat } from '@/lib/city/rasterize-image';
import type { DirtyReason } from '@/lib/city/render-scheduler';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import type { SceneFrame, ScenePlan } from '@/lib/city/plan/scene-data';
import type { PostProcessingOptions } from './post-processing';

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
  /**
   * One frame at the given size as an image, rendered and read in the same call
   * (CR6.T10); the view is restored afterwards. An error result, never a throw.
   */
  captureFrame(width: number, height: number, format: ImageFormat): Result<RasterizedCityImage>;
  /** Free every GPU resource and listener; safe to call twice. */
  dispose(): void;
}
