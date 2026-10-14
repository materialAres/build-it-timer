import type {
  CityGrid,
  CityLayers,
  CityLayerName,
  Theme,
} from '@/components/city/city.types';
import type { Result } from '@/utils/result';
import { getBuildingColor } from './palette';
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

/** Painter's order and parallax fade, mirroring `CityCanvas` (M2.T14). */
const LAYER_ORDER: ReadonlyArray<CityLayerName> = [
  'background',
  'middleground',
  'foreground',
];
const LAYER_OPACITY: Readonly<Record<CityLayerName, number>> = {
  background: 0.4,
  middleground: 0.75,
  foreground: 1,
};
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

interface CityGeometry {
  readonly charWidth: number;
  readonly charHeight: number;
  readonly padding: number;
  readonly fontSize: number;
}

function resolveGeometry(options: CityImageOptions): CityGeometry {
  const charWidth = resolvePositive(options.charWidth, CITY_CHAR_WIDTH);
  const charHeight = resolvePositive(options.charHeight, CITY_CHAR_HEIGHT);
  return {
    charWidth,
    charHeight,
    padding: resolvePositive(options.padding, CITY_IMAGE_PADDING),
    fontSize: resolvePositive(options.fontSize, charHeight),
  };
}

/**
 * One occupied cell as an SVG `<text>`. Empty (`null`/`''`) cells emit nothing
 * but still occupy their column/row, so the image matches `CityCanvas`; a
 * per-cell color wins over the layer fallback.
 */
function renderCell(
  grid: CityGrid,
  rowIndex: number,
  colIndex: number,
  layerColor: string,
  geometry: CityGeometry,
): string | null {
  const cell = grid.cells[rowIndex]?.[colIndex];
  if (cell === undefined || cell.char === null || cell.char === '') return null;

  const color = cell.color ?? layerColor;
  const x = geometry.padding + colIndex * geometry.charWidth;
  const y = geometry.padding + (rowIndex + 1) * geometry.charHeight;
  return `<text x="${x.toString()}" y="${y.toString()}" fill="${color}">${escapeXml(cell.char)}</text>`;
}

/** Render a whole layer, keeping `CityCanvas`'s palette color and depth fade. */
function renderLayer(
  layerName: CityLayerName,
  grid: CityGrid,
  theme: Theme,
  geometry: CityGeometry,
): string {
  const layerColor = getBuildingColor(layerName, theme.palette);
  const text = grid.cells
    .map((row, rowIndex) =>
      row
        .map((_cell, colIndex) =>
          renderCell(grid, rowIndex, colIndex, layerColor, geometry),
        )
        .filter((cell): cell is string => cell !== null)
        .join(''),
    )
    .join('');

  return `<g data-layer="${layerName}" opacity="${LAYER_OPACITY[layerName].toString()}">${text}</g>`;
}

/**
 * Serialize the current three layers to a deterministic SVG (roadmap M3.T8).
 * It mirrors what `CityCanvas` displays: the active theme's `backgroundColor`
 * and palette, the per-cell color override, the parallax opacity and the CRT
 * monospace font. Pure (no DOM access), so it is unit-tested in isolation.
 */
export function buildCityImage(
  layers: CityLayers,
  theme: Theme,
  options: CityImageOptions = {},
): SerializedCityImage {
  const geometry = resolveGeometry(options);
  const width =
    geometry.padding * 2 + layers.background.width * geometry.charWidth;
  const height =
    geometry.padding * 2 + layers.background.height * geometry.charHeight;
  const body = LAYER_ORDER.map((name) =>
    renderLayer(name, layers[name], theme, geometry),
  ).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toString()}" height="${height.toString()}" ` +
    `viewBox="0 0 ${width.toString()} ${height.toString()}">` +
    `<rect width="${width.toString()}" height="${height.toString()}" fill="${theme.backgroundColor}"/>` +
    `<g font-family="${SVG_FONT_FAMILY}" font-size="${geometry.fontSize.toString()}">${body}</g>` +
    '</svg>';

  return { svg, width, height };
}

/**
 * High-level export used by `ExportCityButton`: serialize the layers and
 * rasterize them in the requested format. The component only calls this and
 * handles the download/error UI (Separation of Concerns, §1.1).
 */
export async function exportCityImage(
  layers: CityLayers,
  theme: Theme,
  format: ImageFormat = DEFAULT_IMAGE_FORMAT,
): Promise<Result<RasterizedCityImage>> {
  const { svg, width, height } = buildCityImage(layers, theme);
  return rasterizeCityImage(svg, width, height, format);
}
