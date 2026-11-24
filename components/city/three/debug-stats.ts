export interface DebugStats {
  /** A frame was drawn and took `durationMs` of main-thread time. */
  onFrame(durationMs: number): void;
  /** Count the scene's draw calls; repeats until the scene has something to draw, then stops. */
  measure(): void;
}

/**
 * Debug-only numbers for the e2e budget checks (CR6.T12), written as `data-`
 * attributes on the view's host: `data-render-count`, `data-render-ms` (total
 * main-thread time spent drawing), `data-draw-calls` (scene draw calls,
 * composer passes excluded) and the page times `data-created-at` and
 * `data-first-frame-at` (`performance.now()`). Created only when the page is
 * opened with `?debug=render`; a normal run never touches the DOM per frame.
 */
export function createDebugStats(
  host: HTMLElement,
  sceneDrawCalls: () => number,
  clock: () => number = () => performance.now(),
): DebugStats {
  let count = 0;
  let milliseconds = 0;
  let measured = false;
  host.dataset.createdAt = clock().toFixed(1);
  return {
    onFrame(durationMs): void {
      count += 1;
      milliseconds += durationMs;
      if (count === 1) host.dataset.firstFrameAt = clock().toFixed(1);
      host.dataset.renderCount = String(count);
      host.dataset.renderMs = milliseconds.toFixed(2);
    },
    measure(): void {
      if (measured) return;
      // The first frame can come before the city is added; an empty scene draws nothing.
      const calls = sceneDrawCalls();
      if (calls === 0) return;
      measured = true;
      host.dataset.drawCalls = String(calls);
    },
  };
}
