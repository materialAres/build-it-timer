import type {
  CityCell,
  CityGrid,
  CityLayers,
  CityLayerName,
  SeededRandom,
} from '@/components/city/city.types';

/**
 * Window glyphs in the flattened single-character grid. Growth (M2.T12) pulls
 * one character at a time out of the composed module rows, so the tile
 * library's multi-character window tokens (`[ ]`) reach the grid as individual
 * `[`/`]` pane glyphs. They are detail, not load-bearing structure: the
 * decorator may replace these and only these occupied glyphs.
 */
export const WINDOW_GLYPHS: ReadonlyArray<string> = ['[', ']'];

/**
 * Brightness glyphs a window can be lit with — the card's `[*]`/`[#]`/`[░]`
 * examples projected onto a one-character cell, where the pane itself becomes
 * the bright glyph.
 */
export const LIT_WINDOW_GLYPHS: ReadonlyArray<string> = ['*', '#', '░'];

/**
 * Overlay glyphs drawn on *empty* cells, per layer (roadmap M2.T12b: clouds,
 * trees, streetlights, cars). The middleground — the main skyscrapers — is left
 * untouched so the skyline stays readable; background gets clouds/stars and the
 * foreground the street-level details.
 */
export const DECORATION_GLYPHS: Readonly<Record<
  CityLayerName,
  ReadonlyArray<string>
>> = {
  background: ['~', '.'],
  middleground: [],
  foreground: ['T', '!', 'o'],
};

export const DEFAULT_WINDOW_LIT_CHANCE = 0.45;
export const DEFAULT_DECORATION_CHANCE = 0.05;

/** Tunables of the decoration step (all optional; sensible defaults apply). */
export interface DecorationOptions {
  /** When `false` the decorator is a no-op (criterion 3: disableable step). */
  readonly enabled?: boolean;
  /** Probability, in `[0, 1]`, that an unlit window gets lit. */
  readonly windowLitChance?: number;
  /** Probability, in `[0, 1]`, that an eligible empty cell gets decorated. */
  readonly decorationChance?: number;
}

/** The decoration step as an injectable port, symmetric to `CityGrowthEngine`. */
export type CityDecorator = (
  layers: CityLayers,
  rng: SeededRandom,
) => CityLayers;

/** Clamp an untrusted probability into `[0, 1]` (falls back when non-finite). */
function normalizeChance(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Draw a valid glyph index from the injected generator. The generator is an
 * untrusted collaborator (§1.4), so a non-finite/out-of-range value is clamped
 * instead of yielding `undefined`.
 */
function pickGlyph(
  glyphs: ReadonlyArray<string>,
  rng: SeededRandom,
): string {
  const value = rng.next();
  const normalized = Number.isFinite(value) ? value : 0;
  const index = Math.min(
    Math.max(Math.floor(normalized * glyphs.length), 0),
    glyphs.length - 1,
  );
  return glyphs[index] ?? glyphs[0] ?? '';
}

/** One Bernoulli draw: a non-finite generator value means "do not decorate". */
function roll(rng: SeededRandom, chance: number): boolean {
  const value = rng.next();
  return Number.isFinite(value) && value < chance;
}

/**
 * Decorate a single layer. Occupied cells are never removed; a window glyph
 * may be lit, any other occupied glyph is left exactly as composed. Empty cells
 * may receive an overlay glyph when the layer has decoration glyphs. Returns
 * `null` when nothing changed, so the caller can preserve the input reference.
 */
function decorateGrid(
  grid: CityGrid,
  layer: CityLayerName,
  rng: SeededRandom,
  windowLitChance: number,
  decorationChance: number,
): CityGrid | null {
  const decorations = DECORATION_GLYPHS[layer];

  const cells = grid.cells.map((row) =>
    row.map((cell): CityCell => {
      if (cell.char !== null) {
        if (
          WINDOW_GLYPHS.includes(cell.char) &&
          roll(rng, windowLitChance)
        ) {
          return { ...cell, char: pickGlyph(LIT_WINDOW_GLYPHS, rng) };
        }
        return cell;
      }
      if (decorations.length > 0 && roll(rng, decorationChance)) {
        return { char: pickGlyph(decorations, rng) };
      }
      return cell;
    }),
  );

  const changed = cells.some((row, r) =>
    row.some((cell, c) => cell !== grid.cells[r]?.[c]),
  );
  return changed ? { ...grid, cells } : null;
}

/**
 * Procedural fine details (roadmap M2.T12b): a pure, deterministic transform of
 * the three layers that lights some windows and sprinkles background/foreground
 * decorations while keeping every building's load-bearing structure (the
 * occupied-cell silhouette and its non-window glyphs) intact.
 *
 * It is a *subsequent, optional* step, deliberately decoupled from the growth
 * engine (M2.T12): it never adds or removes building cells, it can be skipped
 * (`enabled: false` returns the input reference), and the growth engine still
 * works on the undecorated layers — decoration is a rendering concern to be
 * applied after growth, never fed back as building structure.
 *
 * Pure: no browser, no clock, and randomness comes only from the injected
 * `rng`; same `(layers, seed)` → same decorated result.
 */
export function decorate(
  layers: CityLayers,
  rng: SeededRandom,
  options: DecorationOptions = {},
): CityLayers {
  const {
    enabled = true,
    windowLitChance = DEFAULT_WINDOW_LIT_CHANCE,
    decorationChance = DEFAULT_DECORATION_CHANCE,
  } = options;
  if (!enabled) return layers;

  const lit = normalizeChance(windowLitChance, DEFAULT_WINDOW_LIT_CHANCE);
  const deco = normalizeChance(decorationChance, DEFAULT_DECORATION_CHANCE);

  const background = decorateGrid(layers.background, 'background', rng, lit, deco);
  const middleground = decorateGrid(
    layers.middleground,
    'middleground',
    rng,
    lit,
    deco,
  );
  const foreground = decorateGrid(layers.foreground, 'foreground', rng, lit, deco);

  if (background === null && middleground === null && foreground === null) {
    return layers;
  }

  return {
    background: background ?? layers.background,
    middleground: middleground ?? layers.middleground,
    foreground: foreground ?? layers.foreground,
  };
}

/**
 * Adapter that binds the options once (symmetric to `createGrowthEngine`,
 * M2.T12), so the wiring task can inject a configured decorator or deliberately
 * disable it with `createDecorator({ enabled: false })`.
 */
export function createDecorator(
  options: DecorationOptions = {},
): CityDecorator {
  return (layers, rng) => decorate(layers, rng, options);
}
