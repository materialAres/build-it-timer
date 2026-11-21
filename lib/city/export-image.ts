import { err, type Result } from '@/utils/result';
import { ENVIRONMENT_COLORS } from './plan/environment-colors';
import {
  rasterizeCityImage,
  DEFAULT_IMAGE_FORMAT,
  type ImageFormat,
  type RasterizedCityImage,
} from './rasterize-image';

export type { ImageFormat } from './rasterize-image';

/** Character-cell geometry of the serialized city. */
export const CITY_CHAR_WIDTH = 8;
export const CITY_CHAR_HEIGHT = 14;
export const CITY_IMAGE_PADDING = 8;

const SVG_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface CityImageOptions {
  readonly charWidth?: number;
  readonly charHeight?: number;
  readonly padding?: number;
  readonly fontSize?: number;
}

/** A text-based (SVG) serialization plus its deterministic pixel dimensions. */
export interface SerializedCityImage {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escape the glyphs that would otherwise break the SVG markup (§1.4). */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

/** Defensively normalize a numeric option: non-finite/non-positive → default. */
function resolvePositive(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

/** One non-blank character as an SVG `<text>` at its grid position. */
function renderChar(
  char: string,
  row: number,
  column: number,
  charWidth: number,
  charHeight: number,
  padding: number,
): string {
  const x = padding + column * charWidth;
  const y = padding + (row + 1) * charHeight;
  return `<text x="${x.toString()}" y="${y.toString()}">${escapeXml(char)}</text>`;
}

/**
 * Serialize the text city (`renderSkyline`, CR6.T8b) to a deterministic SVG:
 * the black floor, one phosphor-green `<text>` per non-blank character on a
 * fixed grid, so the image does not depend on the font that renders it. This
 * is the export path where WebGL is missing or the capture fails. Pure (no DOM
 * access), so it is unit-tested in isolation.
 */
export function buildCityImage(
  rows: ReadonlyArray<string>,
  options: CityImageOptions = {},
): SerializedCityImage {
  const charWidth = resolvePositive(options.charWidth, CITY_CHAR_WIDTH);
  const charHeight = resolvePositive(options.charHeight, CITY_CHAR_HEIGHT);
  const padding = resolvePositive(options.padding, CITY_IMAGE_PADDING);
  const fontSize = resolvePositive(options.fontSize, charHeight);
  const columns = Math.max(0, ...rows.map((row) => row.length));
  const width = padding * 2 + columns * charWidth;
  const height = padding * 2 + rows.length * charHeight;
  const text = rows
    .map((row, rowIndex) =>
      Array.from(row)
        .map((char, column) =>
          char === ' ' ? '' : renderChar(char, rowIndex, column, charWidth, charHeight, padding),
        )
        .join(''),
    )
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toString()}" height="${height.toString()}" ` +
    `viewBox="0 0 ${width.toString()} ${height.toString()}">` +
    `<rect width="${width.toString()}" height="${height.toString()}" fill="${ENVIRONMENT_COLORS.floor}"/>` +
    `<g font-family="${SVG_FONT_FAMILY}" font-size="${fontSize.toString()}" fill="${ENVIRONMENT_COLORS.hud}">${text}</g>` +
    '</svg>';

  return { svg, width, height };
}

/** Size of the exported picture of the 3D city, in pixels (16:9, large enough to share). */
export const EXPORT_WIDTH = 1600;
export const EXPORT_HEIGHT = 900;

/**
 * Renders one frame of the 3D city at a size and reads it (`captureFrame` of the
 * renderer, CR6.T10). Present only while the 3D view is running.
 */
export type FrameCapture = (
  width: number,
  height: number,
  format: ImageFormat,
) => Result<RasterizedCityImage>;

function tryCapture(
  capture: FrameCapture,
  format: ImageFormat,
): Result<RasterizedCityImage> {
  try {
    return capture(EXPORT_WIDTH, EXPORT_HEIGHT, format);
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}

/**
 * High-level export used by `ExportCityButton` (§1.4 boundary: every failure is
 * a `Result`). With the 3D view running it is the 3D frame at `EXPORT_WIDTH` ×
 * `EXPORT_HEIGHT`; without it (no WebGL, a lost context) or when the capture
 * fails, it is the text city serialized as SVG. The component only calls this
 * and handles the download/error UI (Separation of Concerns, §1.1).
 */
export async function exportCityImage(
  rows: ReadonlyArray<string>,
  format: ImageFormat = DEFAULT_IMAGE_FORMAT,
  capture: FrameCapture | null = null,
): Promise<Result<RasterizedCityImage>> {
  if (capture !== null) {
    const framed = tryCapture(capture, format);
    if (framed.ok) return framed;
  }
  const { svg, width, height } = buildCityImage(rows);
  return rasterizeCityImage(svg, width, height, format);
}
