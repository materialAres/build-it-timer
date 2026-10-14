import { err, ok, type Result } from '@/utils/result';

/** Raster formats the user can export the finished city as (roadmap M3.T8). */
export type ImageFormat = 'png' | 'jpeg';

/** PNG is lossless, so it is the default the component offers first. */
export const DEFAULT_IMAGE_FORMAT: ImageFormat = 'png';

export const IMAGE_MIME_TYPES: Readonly<Record<ImageFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/** JPEG quality (0..1); PNG ignores it (lossless). */
const JPEG_QUALITY = 0.92;

/** The rasterized result, ready to be handed to a download. */
export interface RasterizedCityImage {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

/** Encode an SVG string as a `data:` URL the browser can rasterize. */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Could not load the serialized city image'));
    };
    image.src = src;
  });
}

/**
 * Rasterize an SVG to PNG/JPEG through an offscreen canvas (M3.T8). This is the
 * DOM/canvas boundary of the export (§1.4): a missing 2D context, an image that
 * fails to load, or a canvas error all resolve as `{ ok: false }` instead of
 * throwing into the popup, which stays usable.
 */
export async function rasterizeCityImage(
  svg: string,
  width: number,
  height: number,
  format: ImageFormat = DEFAULT_IMAGE_FORMAT,
): Promise<Result<RasterizedCityImage>> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      return err(new Error('Canvas 2D context is unavailable'));
    }

    const image = await loadImage(svgToDataUrl(svg));
    context.drawImage(image, 0, 0, width, height);

    const mimeType = IMAGE_MIME_TYPES[format];
    const dataUrl =
      format === 'jpeg'
        ? canvas.toDataURL(mimeType, JPEG_QUALITY)
        : canvas.toDataURL(mimeType);

    return ok({ dataUrl, mimeType, width, height });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
