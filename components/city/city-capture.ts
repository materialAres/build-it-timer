import type { FrameCapture } from '@/lib/city/export-image';

/**
 * The bridge between the 3D view and the export button (CR6.T10). The view is a
 * lazy chunk and the button is not, so the view registers its capture here
 * while it runs and removes it when it goes; the button reads it when clicked.
 * No capture means no 3D view (no WebGL, a lost context, the tab not open yet),
 * and the export then uses the text city.
 */
let current: FrameCapture | null = null;

export function setCityCapture(capture: FrameCapture | null): void {
  current = capture;
}

/** Remove `capture` only if it is still the registered one (a newer view may have replaced it). */
export function clearCityCapture(capture: FrameCapture): void {
  if (current === capture) current = null;
}

export function getCityCapture(): FrameCapture | null {
  return current;
}
