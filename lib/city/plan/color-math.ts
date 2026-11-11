export interface Hsl {
  readonly h: number; // degrees [0, 360)
  readonly s: number; // [0, 1]
  readonly l: number; // [0, 1]
}

type Rgb = readonly [number, number, number];

/** `#rrggbb` to 0–255 channels; anything else reads as black (untrusted input, §1.4). */
function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  const value = match?.[1];
  if (value === undefined) return [0, 0, 0];
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (channel: number): string =>
  Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0');

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (sector * 60 + 360) % 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] = (
    [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]] as const
  )[Math.min(5, Math.floor(hue))] ?? [0, 0, 0];
  const m = l - chroma / 2;
  return `#${toHex((r + m) * 255)}${toHex((g + m) * 255)}${toHex((b + m) * 255)}`;
}

/** Rotate the hue, keeping saturation and lightness; greys are unchanged. */
export function shiftHue(hex: string, degrees: number): string {
  const { h, s, l } = hexToHsl(hex);
  if (s === 0 || degrees === 0) return hex;
  return hslToHex(h + degrees, s, l);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
