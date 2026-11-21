import { useEffect, type RefObject } from 'react';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';
import { hashString } from '@/utils/hash';
import type { FrameCapture } from '@/lib/city/export-image';
import type { CityRenderer } from './three/city-renderer';

/** The e2e hooks are on only when the page is opened with `?debug=render` (CR6.T12). */
export function isDebugRender(): boolean {
  return new URLSearchParams(globalThis.location.search).get('debug') === 'render';
}

/** A short fingerprint of what a plan looks like, so a test can tell two cities apart. */
export function planFingerprint(plan: CityPlan): number {
  return hashString(
    JSON.stringify([
      plan.layoutId,
      plan.paletteId,
      plan.hueShift,
      plan.totalFloors,
      plan.buildings.map((b) => [b.archetypeId, b.height, b.color]),
    ]),
  );
}

/**
 * Debug-only hooks for the e2e (CR6.T12): the plan's fingerprint as
 * `data-plan-hash` on the host and the renderer's capture as
 * `window.__buildItCapture`, so a test can prove two sessions differ and that a
 * capture works on a real GPU. Does nothing in a normal run.
 */
export function useCityDebug(
  host: RefObject<HTMLElement | null>,
  plan: CityPlan | null,
  renderer: CityRenderer | null,
): void {
  useEffect(() => {
    const element = host.current;
    if (!isDebugRender() || element === null || plan === null) return undefined;
    element.dataset.planHash = String(planFingerprint(plan));
    return () => { delete element.dataset.planHash; };
  }, [host, plan]);

  useEffect(() => {
    if (!isDebugRender() || renderer === null) return undefined;
    const capture: FrameCapture = (width, height, format) => renderer.captureFrame(width, height, format);
    const target = globalThis as unknown as Record<string, unknown>;
    target.__buildItCapture = capture;
    return () => { delete target.__buildItCapture; };
  }, [renderer]);
}
