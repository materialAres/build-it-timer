import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8');

/** Every popup source file under `dir` that can carry styles. */
function sources(dir: string): string[] {
  const absolute = resolve(ROOT, dir);
  return readdirSync(absolute).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(resolve(ROOT, path)).isDirectory()) return sources(path);
    return /\.(css|ts|tsx)$/.test(name) ? [path] : [];
  });
}

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const APP_CSS = read('entrypoints/popup/App.css');
const INK_FIELD = '#0b0f14';

/**
 * UI.T5 — the visual-coherence rules of DESIGN.md as regression guards. CSS is
 * not rendered by happy-dom, so these read the style sources: they stop a
 * deviation (a second accent, a native-styled button, a failing placeholder, a
 * missing focus ring) from creeping back in unnoticed.
 */
describe('popup visual coherence (UI.T5)', () => {
  const interfaceSources = [
    ...sources('components/blocklist'),
    ...sources('components/timer'),
    ...sources('components/common').filter((p) => !p.includes('BlockedOverlay')),
    ...sources('entrypoints/popup'),
  ];

  it('keeps phosphor green as the only interface accent (score tiers excepted)', () => {
    const offenders = interfaceSources.filter((path) =>
      read(path).toLowerCase().includes('#4dabf7'),
    );
    expect(offenders).toEqual([]);
  });

  it('uses one off-white for text: #e6e6e6, not a near duplicate', () => {
    const offenders = interfaceSources.filter((path) =>
      read(path).toLowerCase().includes('#e9ecef'),
    );
    expect(offenders).toEqual([]);
  });

  it('styles every popup button as the outline pill by default', () => {
    expect(APP_CSS).toMatch(/:where\(\.popup\) button\s*\{[^}]*border-radius:\s*999px/);
    expect(APP_CSS).toMatch(/:where\(\.popup\) button\s*\{[^}]*background:\s*transparent/);
    expect(APP_CSS).toMatch(/:where\(\.popup\) button\s*\{[^}]*color:\s*#7dfba0/);
  });

  it('draws a phosphor focus ring on every focusable control', () => {
    expect(APP_CSS).toMatch(
      /:where\(\.popup\) :focus-visible\s*\{[^}]*outline:\s*1px solid #7dfba0/,
    );
  });

  it('keeps placeholders at AA contrast (4.5:1) on the input field', () => {
    const match = /::placeholder\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i.exec(APP_CSS);
    expect(match).not.toBeNull();
    expect(contrast(match?.[1] ?? '#000000', INK_FIELD)).toBeGreaterThanOrEqual(4.5);
  });

  it('sets the monospace stack on inputs, which Chrome gives a sans font', () => {
    expect(read('entrypoints/popup/style.css')).toMatch(
      /button,\s*input\s*\{[^}]*font-family:\s*inherit/,
    );
  });

  it('spaces the timer controls instead of letting them touch', () => {
    expect(APP_CSS).toMatch(/\.timer-controls\s*\{[^}]*gap:/);
  });
});
