import { useEffect, useMemo, useRef } from 'react';
import type { FrameCapture } from '@/lib/city/export-image';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { createSceneFrame, createScenePlan } from '@/lib/city/plan/scene-data';
import { clearCityCapture, setCityCapture } from './city-capture';
import { useCityDebug } from './use-city-debug';
import { useCityRenderer } from './use-city-renderer';
import type { ProbedCanvas } from './webgl-support';

/**
 * The 3D city (CR6.T8a). This module and everything it imports, `three`
 * included, is one lazy chunk: the City tab loads it, the Timer tab never does.
 * It reads the plan and the visible floors through selectors and hands them to
 * the renderer; it computes nothing itself (§1.3).
 */
export interface CityView3DProps {
  /** Called once when WebGL cannot start or its context is lost; the parent switches to the text fallback. */
  readonly onUnavailable?: () => void;
  /** The full-city page's free camera (CR6.T11). */
  readonly freeCamera?: boolean;
  /** The panel's WebGL2 probe; the renderer draws on its canvas (#22). */
  readonly probe?: ProbedCanvas;
}

export default function CityView3D({ onUnavailable, freeCamera = false, probe }: CityView3DProps) {
  const plan = useAppStore(selectCityPlan);
  const visible = useAppStore(selectVisibleFloors);
  const host = useRef<HTMLDivElement>(null);
  const { renderer, failed } = useCityRenderer(host, plan !== null, freeCamera, probe);
  useCityDebug(host, plan, renderer);
  const scene = useMemo(() => (plan === null ? null : createScenePlan(plan)), [plan]);

  useEffect(() => {
    if (!renderer) return undefined;
    const capture: FrameCapture = (width, height, format) => renderer.captureFrame(width, height, format);
    setCityCapture(capture);
    return () => { clearCityCapture(capture); };
  }, [renderer]);

  useEffect(() => {
    if (failed) onUnavailable?.();
  }, [failed, onUnavailable]);

  useEffect(() => {
    if (renderer && plan && scene) renderer.setScene(scene, plan);
  }, [renderer, plan, scene]);

  useEffect(() => {
    if (renderer && plan && scene) renderer.setFrame(createSceneFrame(scene, plan, visible));
  }, [renderer, plan, scene, visible]);

  return <div ref={host} className="city-view" aria-hidden="true" />;
}
