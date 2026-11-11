import { describe, it, expect } from 'vitest';
import {
  buildCityImage,
  CITY_CHAR_HEIGHT,
  CITY_CHAR_WIDTH,
  CITY_IMAGE_PADDING,
} from '@/lib/city/export-image';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';

const countTexts = (svg: string): number => svg.split('<text').length - 1;

describe('buildCityImage (M3.T8, text city since CR6.T9a)', () => {
  it('computes deterministic dimensions from the rows', () => {
    const image = buildCityImage(['abc', 'def']);

    expect(image.width).toBe(3 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
    expect(image.height).toBe(2 * CITY_CHAR_HEIGHT + CITY_IMAGE_PADDING * 2);
    expect(image.svg).toContain(`width="${String(image.width)}"`);
    expect(image.svg).toContain(`height="${String(image.height)}"`);
    expect(image.svg).toContain(`viewBox="0 0 ${String(image.width)} ${String(image.height)}"`);
  });

  it('paints the black floor and phosphor-green text', () => {
    const { svg } = buildCityImage(['#']);

    expect(svg).toContain(`fill="${ENVIRONMENT_COLORS.floor}"`);
    expect(svg).toContain(`fill="${ENVIRONMENT_COLORS.hud}"`);
  });

  it('emits one text per non-blank character at its grid position', () => {
    const { svg } = buildCityImage(['#  .', ' :   ']);

    expect(countTexts(svg)).toBe(3);
    expect(svg).toContain(
      `<text x="${String(CITY_IMAGE_PADDING)}" y="${String(CITY_IMAGE_PADDING + CITY_CHAR_HEIGHT)}">#</text>`,
    );
    expect(svg).toContain(
      `<text x="${String(CITY_IMAGE_PADDING + CITY_CHAR_WIDTH)}" y="${String(CITY_IMAGE_PADDING + 2 * CITY_CHAR_HEIGHT)}">:</text>`,
    );
  });

  it('emits no text for blanks but keeps the full-grid dimensions', () => {
    const image = buildCityImage(['   ', '   ']);

    expect(countTexts(image.svg)).toBe(0);
    expect(image.width).toBe(3 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
  });

  it('escapes the glyphs that would break the SVG markup', () => {
    const { svg } = buildCityImage(['<&>"\'']);

    for (const escaped of ['&lt;', '&amp;', '&gt;', '&quot;', '&apos;']) {
      expect(svg).toContain(`${escaped}</text>`);
    }
  });

  it('honors custom geometry options and defends against non-finite ones', () => {
    const rows = ['ab', 'cd'];

    const custom = buildCityImage(rows, { charWidth: 10, charHeight: 20, padding: 5 });
    expect(custom.width).toBe(2 * 10 + 5 * 2);
    expect(custom.height).toBe(2 * 20 + 5 * 2);

    const defensive = buildCityImage(rows, {
      charWidth: Number.NaN,
      charHeight: -1,
      padding: Number.POSITIVE_INFINITY,
    });
    expect(defensive.width).toBe(2 * CITY_CHAR_WIDTH + CITY_IMAGE_PADDING * 2);
    expect(defensive.height).toBe(2 * CITY_CHAR_HEIGHT + CITY_IMAGE_PADDING * 2);
  });

  it('handles an empty city without throwing', () => {
    const image = buildCityImage([]);

    expect(image.width).toBe(CITY_IMAGE_PADDING * 2);
    expect(image.height).toBe(CITY_IMAGE_PADDING * 2);
    expect(countTexts(image.svg)).toBe(0);
  });

  it('is deterministic: the same rows yield the same image', () => {
    const rows = ['#  .', ' :  '];

    expect(buildCityImage(rows)).toEqual(buildCityImage(rows));
  });
});
