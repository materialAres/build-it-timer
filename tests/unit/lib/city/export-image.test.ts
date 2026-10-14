import { describe, it, expect } from 'vitest';
import {
  buildCityImage,
  CITY_CHAR_HEIGHT,
  CITY_CHAR_WIDTH,
  CITY_IMAGE_PADDING,
} from '@/lib/city/export-image';
import { getBuildingColor } from '@/lib/city/palette';
import type {
  CityCell,
  CityGrid,
  CityLayers,
  Theme,
} from '@/components/city/city.types';

const THEME: Theme = {
  id: 'test-theme',
  name: 'Test',
  palette: ['#111111', '#222222', '#333333', '#444444'],
  backgroundColor: '#0a0b0c',
};

/** Build a grid where `occupied` is keyed by `"row:col"`. */
function makeGrid(
  width: number,
  height: number,
  occupied: Readonly<Record<string, CityCell>> = {},
): CityGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, (_, row) =>
      Array.from(
        { length: width },
        (_, col) => occupied[`${String(row)}:${String(col)}`] ?? { char: null },
      ),
    ),
  };
}

function makeLayers(overrides: Partial<CityLayers> = {}): CityLayers {
  return {
    background: makeGrid(2, 2),
    middleground: makeGrid(2, 2),
    foreground: makeGrid(2, 2),
    ...overrides,
  };
}

const countTexts = (svg: string): number => svg.split('<text').length - 1;

describe('buildCityImage (M3.T8)', () => {
  it('computes deterministic dimensions from the grid size', () => {
    const image = buildCityImage(makeLayers({ background: makeGrid(3, 2) }), THEME);

    expect(image.width).toBe(3 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
    expect(image.height).toBe(2 * CITY_CHAR_HEIGHT + CITY_IMAGE_PADDING * 2);
    expect(image.svg).toContain(`width="${String(image.width)}"`);
    expect(image.svg).toContain(`height="${String(image.height)}"`);
    expect(image.svg).toContain(
      `viewBox="0 0 ${String(image.width)} ${String(image.height)}"`,
    );
  });

  it('uses the active theme background color', () => {
    const image = buildCityImage(makeLayers(), THEME);

    expect(image.svg).toContain(`fill="${THEME.backgroundColor}"`);
  });

  it('paints an occupied cell with the active palette color of its layer', () => {
    const layers = makeLayers({
      background: makeGrid(2, 2, { '0:0': { char: '#' } }),
    });
    const expected = getBuildingColor('background', THEME.palette);

    const image = buildCityImage(layers, THEME);

    expect(image.svg).toContain(`fill="${expected}">#</text>`);
    expect(image.svg).toContain('data-layer="background"');
  });

  it('lets a per-cell color override the layer palette color', () => {
    const layers = makeLayers({
      middleground: makeGrid(2, 2, { '1:1': { char: '|', color: '#ff0000' } }),
    });

    const image = buildCityImage(layers, THEME);

    expect(image.svg).toContain('fill="#ff0000">|</text>');
  });

  it('emits no text for empty cells but keeps the full-grid dimensions', () => {
    const layers = makeLayers({
      background: makeGrid(4, 3, { '0:0': { char: '.' } }),
    });

    const image = buildCityImage(layers, THEME);

    expect(countTexts(image.svg)).toBe(1);
    expect(image.width).toBe(4 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
    expect(image.height).toBe(3 * CITY_CHAR_HEIGHT + CITY_IMAGE_PADDING * 2);
  });

  it('renders the three layers with the CityCanvas parallax ordering', () => {
    const image = buildCityImage(makeLayers(), THEME);

    const background = image.svg.indexOf('data-layer="background"');
    const middleground = image.svg.indexOf('data-layer="middleground"');
    const foreground = image.svg.indexOf('data-layer="foreground"');
    expect(background).toBeGreaterThan(-1);
    expect(background).toBeLessThan(middleground);
    expect(middleground).toBeLessThan(foreground);
  });

  it('escapes the glyphs that would break the SVG markup', () => {
    const layers = makeLayers({
      background: makeGrid(2, 2, { '0:0': { char: '<' }, '0:1': { char: '&' } }),
    });

    const image = buildCityImage(layers, THEME);

    expect(image.svg).toContain('&lt;</text>');
    expect(image.svg).toContain('&amp;</text>');
  });

  it('honors custom geometry options and defends against non-finite ones', () => {
    const layers = makeLayers({ background: makeGrid(2, 2) });

    const custom = buildCityImage(layers, THEME, {
      charWidth: 10,
      charHeight: 20,
      padding: 5,
    });
    expect(custom.width).toBe(2 * 10 + 5 * 2);
    expect(custom.height).toBe(2 * 20 + 5 * 2);

    const defensive = buildCityImage(layers, THEME, {
      charWidth: Number.NaN,
      charHeight: -1,
      padding: Number.POSITIVE_INFINITY,
    });
    expect(defensive.width).toBe(2 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
    expect(defensive.height).toBe(2 * CITY_CHAR_HEIGHT + CITY_IMAGE_PADDING * 2);
  });

  it('is deterministic: the same grid and theme yield the same image', () => {
    const layers = makeLayers({
      background: makeGrid(3, 2, { '0:0': { char: '#' }, '1:2': { char: '.' } }),
    });

    expect(buildCityImage(layers, THEME)).toEqual(buildCityImage(layers, THEME));
  });
});
