import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest';
import {
  buildCityImage,
  CITY_CHAR_HEIGHT,
  CITY_CHAR_WIDTH,
  CITY_IMAGE_PADDING,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  exportCityImage,
  type FrameCapture,
} from '@/lib/city/export-image';
import { ENVIRONMENT_COLORS } from '@/lib/city/plan/environment-colors';
import type * as rasterizeModule from '@/lib/city/rasterize-image';
import { rasterizeCityImage, type RasterizedCityImage } from '@/lib/city/rasterize-image';
import { err, ok } from '@/utils/result';

vi.mock('@/lib/city/rasterize-image', async (importOriginal) => ({
  ...(await importOriginal<typeof rasterizeModule>()),
  rasterizeCityImage: vi.fn(),
}));

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

describe('exportCityImage (CR6.T10)', () => {
  const FRAME: RasterizedCityImage = { dataUrl: 'data:image/png;base64,3D', mimeType: 'image/png', width: EXPORT_WIDTH, height: EXPORT_HEIGHT };
  const TEXT: RasterizedCityImage = { dataUrl: 'data:image/png;base64,TEXT', mimeType: 'image/png', width: 10, height: 10 };
  const rasterize = rasterizeCityImage as Mock<typeof rasterizeCityImage>;

  beforeEach(() => {
    rasterize.mockReset();
    rasterize.mockResolvedValue(ok(TEXT));
  });

  it('exports a frame of the 3D view at the export size when it is running', async () => {
    const capture = vi.fn<FrameCapture>(() => ok(FRAME));

    const result = await exportCityImage(['#'], 'png', capture);

    expect(capture).toHaveBeenCalledWith(EXPORT_WIDTH, EXPORT_HEIGHT, 'png');
    expect(result).toEqual(ok(FRAME));
    expect(rasterize).not.toHaveBeenCalled();
  });

  it('passes the chosen format to the capture', async () => {
    const capture = vi.fn<FrameCapture>(() => ok(FRAME));
    await exportCityImage(['#'], 'jpeg', capture);
    expect(capture).toHaveBeenCalledWith(EXPORT_WIDTH, EXPORT_HEIGHT, 'jpeg');
  });

  it('exports the text city when there is no 3D view (no WebGL)', async () => {
    const result = await exportCityImage(['#'], 'png', null);

    expect(result).toEqual(ok(TEXT));
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(rasterize.mock.calls[0]?.[0]).toContain('<text');
  });

  it('exports the text city when no capture is given at all', async () => {
    expect(await exportCityImage(['#'])).toEqual(ok(TEXT));
  });

  it('falls back to the text city when the capture fails', async () => {
    const capture = vi.fn<FrameCapture>(() => err(new Error('context lost')));
    expect(await exportCityImage(['#'], 'png', capture)).toEqual(ok(TEXT));
  });

  it('falls back to the text city, and does not throw, when the capture throws', async () => {
    const capture = vi.fn<FrameCapture>(() => { throw new Error('boom'); });
    expect(await exportCityImage(['#'], 'png', capture)).toEqual(ok(TEXT));
  });

  it('still reports an error when even the text city cannot be made', async () => {
    rasterize.mockResolvedValue(err(new Error('no 2D context')));
    const result = await exportCityImage(['#'], 'png', null);
    expect(result.ok).toBe(false);
  });
});
