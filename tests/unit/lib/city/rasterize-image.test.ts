import { describe, it, expect } from 'vitest';
import {
  IMAGE_MIME_TYPES,
  rasterizeCityImage,
  svgToDataUrl,
} from '@/lib/city/rasterize-image';

describe('svgToDataUrl (M3.T8)', () => {
  it('encodes the SVG markup into an image data URL', () => {
    const url = svgToDataUrl('<svg><text>#</text></svg>');

    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).toContain('%3Csvg%3E');
    expect(url).not.toContain('<svg>');
  });
});

describe('IMAGE_MIME_TYPES (M3.T8)', () => {
  it('offers both a PNG and a JPEG output', () => {
    expect(IMAGE_MIME_TYPES.png).toBe('image/png');
    expect(IMAGE_MIME_TYPES.jpeg).toBe('image/jpeg');
  });
});

describe('rasterizeCityImage (M3.T8)', () => {
  it('fails as a Result instead of throwing when no 2D context is available', async () => {
    // `happy-dom` has no canvas adapter, so `getContext('2d')` is null here:
    // this is exactly the boundary the guard protects (§1.4).
    const result = await rasterizeCityImage('<svg/>', 10, 10, 'png');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Canvas 2D context is unavailable');
    }
  });
});
