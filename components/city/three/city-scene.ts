import { Group } from 'three';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import type { SceneFrame, ScenePlan } from '@/lib/city/plan/scene-data';
import { createAmbientLayer } from './ambient-layer';
import { createCityLabels } from './city-labels';
import { createCityMeshes } from './city-meshes';
import { createFloorAnimations } from './floor-animations';

export interface CitySceneInput {
  readonly scene: ScenePlan;
  readonly plan: CityPlan;
  /** Whether the ambient layer (rain, cars, flicker, beacons) exists at all. */
  readonly ambient: boolean;
  readonly reducedMotion: boolean;
}

export interface CityScene {
  readonly group: Group;
  /** A floor animation is running, so frames are needed until it ends. */
  readonly animating: boolean;
  /** Show the floors of a frame at `now` (ms): growth drops in, removal glitches out. */
  setFrame(frame: SceneFrame, now: number): void;
  /** Advance the animations and the ambient layer to `now` (ms), before a draw. */
  update(now: number): void;
  /** Turn the labels to face a camera with these axes. */
  orient(right: readonly [number, number, number], up: readonly [number, number, number]): void;
  /** Reduced motion on: no animations, no ambient motion; growth and damage still show, as static changes. */
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

/**
 * The whole city for the renderer: the meshes of CR6.T6b plus the floor
 * animations, the ambient layer and the tower labels of CR6.T7, each behind
 * its own module. The renderer only talks to this.
 */
export function createCityScene(input: CitySceneInput): CityScene {
  const meshes = createCityMeshes({ scene: input.scene, plan: input.plan });
  const animations = createFloorAnimations({
    slots: meshes.slots,
    setVisibleCount: (count) => { meshes.setVisibleCount(count); },
  });
  const ambient = createAmbientLayer({
    plan: input.plan,
    setWindows: (slot, level) => { meshes.slots.setWindows(slot, level); },
  });
  const labels = createCityLabels(input.scene.labels);
  const group = new Group();
  group.add(meshes.group, ambient.group);
  if (labels) group.add(labels.mesh);

  const setReducedMotion = (reduced: boolean): void => {
    const ambientOn = input.ambient && !reduced;
    animations.setEnabled(!reduced);
    animations.setFlicker(ambientOn);
    ambient.setMotion(ambientOn);
  };
  setReducedMotion(input.reducedMotion);

  return {
    group,
    get animating(): boolean {
      return animations.active;
    },
    setFrame(frame, now): void {
      meshes.applyFrame(frame);
      animations.setFrame(frame, now);
      ambient.setComplete(frame.partial ? frame.instanceCount - 1 : frame.instanceCount);
      labels?.show(frame.labels);
      animations.update(now, false);
    },
    update(now): void {
      animations.update(now, ambient.update(now));
    },
    orient(right, up): void {
      labels?.orient(right, up);
    },
    setReducedMotion,
    dispose(): void {
      meshes.dispose();
      ambient.dispose();
      labels?.dispose();
    },
  };
}
