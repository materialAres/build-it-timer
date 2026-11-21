import { err, ok, type Result } from '@/utils/result';
import {
  IMAGE_MIME_TYPES,
  JPEG_QUALITY,
  type ImageFormat,
  type RasterizedCityImage,
} from '@/lib/city/rasterize-image';

/** The largest side of a capture, in pixels: well inside what a GPU can render and a canvas can encode. */
export const MAX_CAPTURE_SIZE = 4096;

/** What a capture needs from the renderer, so it can be tested without WebGL. */
export interface CaptureHost {
  readonly canvas: { toDataURL(type: string, quality?: number): string };
  readonly pixelRatio: { get(): number; set(ratio: number): void };
  /** Size the canvas, the camera and the composer; `updateStyle` false keeps the on-screen box. */
  readonly fit: (width: number, height: number, updateStyle: boolean) => void;
  /** Draw the scene now. */
  readonly draw: () => void;
  readonly viewSize: () => { readonly width: number; readonly height: number };
  /** The view is back to its own size: draw it again, resizing cleared the canvas. */
  readonly restored: () => void;
}

const validSide = (value: number): boolean => Number.isFinite(value) && value >= 0.5 && value <= MAX_CAPTURE_SIZE;

/**
 * One frame of the city at `width` × `height`, as an image (CR6.T10). It
 * renders and reads in the same call, so the drawing buffer need not be
 * preserved (`preserveDrawingBuffer` stays off), at pixel ratio 1 so the image
 * has exactly the size asked for. The view is put back afterwards whatever
 * happens. It is a boundary (§1.4): a lost context or an unreadable canvas is
 * an error result, never an exception.
 */
export function captureFrame(
  host: CaptureHost,
  width: number,
  height: number,
  format: ImageFormat,
): Result<RasterizedCityImage> {
  if (!validSide(width) || !validSide(height)) {
    return err(new Error(`Cannot capture a ${String(width)} x ${String(height)} image`));
  }
  const [w, h] = [Math.round(width), Math.round(height)];
  const mimeType = IMAGE_MIME_TYPES[format];
  const ratio = host.pixelRatio.get();
  const view = host.viewSize();
  try {
    host.pixelRatio.set(1);
    host.fit(w, h, false);
    host.draw();
    const dataUrl = format === 'jpeg' ? host.canvas.toDataURL(mimeType, JPEG_QUALITY) : host.canvas.toDataURL(mimeType, undefined);
    if (!dataUrl.startsWith('data:image/')) return err(new Error('The canvas could not be read'));
    return ok({ dataUrl, mimeType, width: w, height: h });
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error(String(cause)));
  } finally {
    host.pixelRatio.set(ratio);
    if (view.width > 0 && view.height > 0) host.fit(view.width, view.height, true);
    host.restored();
  }
}
