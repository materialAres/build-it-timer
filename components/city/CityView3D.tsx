import { useEffect, useMemo, useRef } from 'react';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { createSceneFrame, createScenePlan } from '@/lib/city/plan/scene-data';
import { useCityRenderer } from './use-city-renderer';

/**
 * The 3D city (CR6.T8a). This module and everything it imports, `three`
 * included, is one lazy chunk: the City tab loads it, the Timer tab never does.
 * It reads the plan and the visible floors through selectors and hands them to
 * the renderer; it computes nothing itself (§1.3).
 */
export interface CityView3DProps {
  /** Called once when WebGL cannot start or its context is lost; the parent switches to the text fallback. */
  readonly onUnavailable?: () => void;
}

export default function CityView3D({ onUnavailable }: CityView3DProps) {
  const plan = useAppStore(selectCityPlan);
  const visible = useAppStore(selectVisibleFloors);
  const host = useRef<HTMLDivElement>(null);
  const { renderer, failed } = useCityRenderer(host, plan !== null);
  const scene = useMemo(() => (plan === null ? null : createScenePlan(plan)), [plan]);

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
