import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hexToHsl,
  hslToHex,
  shiftHue,
} from '@/lib/city/plan/color-math';

describe('color-math (CR6.T3)', () => {
  it('round-trips hex through HSL', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#7dfba0', '#ffb000', '#808080']) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex);
    }
  });

  it('shifts only the hue, keeping saturation and lightness', () => {
    const before = hexToHsl('#00e5ff');
    const after = hexToHsl(shiftHue('#00e5ff', 20));
    expect(after.h).toBeCloseTo((before.h + 20) % 360, 0);
    expect(after.s).toBeCloseTo(before.s, 1);
    expect(after.l).toBeCloseTo(before.l, 1);
  });

  it('wraps the hue around the circle in both directions', () => {
    expect(shiftHue('#ff0000', 360)).toBe('#ff0000');
    expect(hexToHsl(shiftHue('#ff0000', -20)).h).toBeCloseTo(340, 0);
  });

  it('leaves a shift of 0 and greys unchanged', () => {
    expect(shiftHue('#7dfba0', 0)).toBe('#7dfba0');
    expect(shiftHue('#808080', 25)).toBe('#808080');
  });

  it('computes the WCAG contrast ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});
