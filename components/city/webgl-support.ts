/**
 * The context attributes of the 3D view: no MSAA, a low-power GPU, no
 * preserved drawing buffer, an opaque canvas. The probe asks for exactly these,
 * because a canvas keeps the attributes of its first context and the renderer
 * draws on the probed one.
 */
export const GL_ATTRIBUTES: Readonly<WebGLContextAttributes> = {
  antialias: false,
  powerPreference: 'low-power',
  preserveDrawingBuffer: false,
  alpha: false,
};

/**
 * A canvas whose WebGL2 context is already made (open issue #22). The first
 * context of a page is the expensive one (the GPU side starts, about 160 ms on
 * the reference machine), so the renderer takes this canvas instead of making a
 * second context. Whoever does not take it releases it.
 */
export interface ProbedCanvas {
  /** The canvas, once; null afterwards. */
  take(): HTMLCanvasElement | null;
  /** Lose the context if nobody took the canvas (the view went away first). */
  release(): void;
}

/**
 * Whether this browser can start the 3D view (CR6.T8b): three.js needs WebGL2.
 * Never throws; "cannot tell" means null, as does a browser without WebGL2.
 */
export function probeWebGl2(doc: Document = document): ProbedCanvas | null {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', GL_ATTRIBUTES);
    if (gl === null) return null;
    let held: HTMLCanvasElement | null = canvas;
    return {
      take(): HTMLCanvasElement | null {
        const taken = held;
        held = null;
        return taken;
      },
      release(): void {
        if (held === null) return;
        held = null;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  } catch {
    return null;
  }
}

/**
 * Run `work` after the browser has painted once more: the next animation frame
 * comes before a paint, a task queued from it runs after. The WebGL check is
 * slow and synchronous, so the City tab paints its text city first (#22).
 * Returns a cancel function.
 */
export function afterFirstPaint(work: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const frame = requestAnimationFrame(() => {
    if (!cancelled) timer = setTimeout(work, 0);
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
  };
}
