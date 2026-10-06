import type {
  BuildingModule,
  BuildingModuleCategory,
  ComposedBuilding,
  SeededRandom,
} from '@/components/city/city.types';
import { getModulesByCategory } from './tile-library';

/**
 * One unlock rule of the building composition schedule (M2.T11c): once the
 * focused time reaches `minuteThreshold`, the `moduleCategory` becomes
 * available. The thresholds are *data* (Open/Closed, §1.1): adding, removing or
 * retuning a step means editing this array, never touching `composeBuilding`.
 */
export interface BuildingUnlockRule {
  readonly minuteThreshold: number;
  readonly moduleCategory: BuildingModuleCategory;
}

/**
 * Ordered unlock schedule — the roadmap's example: 5' base, 10' first floor,
 * 20' an additional floor, 25' the top element. Order is significant: a
 * module's variant is drawn from `rng` in schedule order, so a module that is
 * already unlocked keeps its variant as the building grows and only newly
 * unlocked categories consume new random draws (the building evolves instead of
 * being re-rolled).
 */
export const BUILDING_UNLOCK_SCHEDULE: ReadonlyArray<BuildingUnlockRule> = [
  { minuteThreshold: 5, moduleCategory: 'base' },
  { minuteThreshold: 10, moduleCategory: 'floor' },
  { minuteThreshold: 20, moduleCategory: 'floor' },
  { minuteThreshold: 25, moduleCategory: 'top' },
];

/**
 * Clamp untrusted focused time (§1.4), mirroring the defensive policy of
 * `calculateScore` (M2.T9): `NaN` is "no time yet" (unbuilt), `-Infinity`/a
 * negative value clamp to 0, `+Infinity` stays infinite so everything unlocks.
 */
function normalizeMinutes(minutesFocused: number): number {
  if (Number.isNaN(minutesFocused)) return 0;
  return Math.max(0, minutesFocused);
}

/**
 * Draw a valid variant index from the injected generator. The generator is an
 * untrusted collaborator (§1.4), so a non-finite or out-of-range value is
 * clamped into `[0, length - 1]` instead of yielding `undefined`.
 */
function drawVariantIndex(rng: SeededRandom, length: number): number {
  const value = rng.next();
  const normalized = Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(Math.floor(normalized * length), 0), length - 1);
}

/**
 * Center a module row on a wider building so a narrower module (e.g. a top on a
 * wide base) still lines up on the character grid; rows are already exactly
 * `widthChars` wide when the widths match.
 */
function padRow(row: string, widthChars: number): string {
  if (row.length >= widthChars) return row;
  const total = widthChars - row.length;
  const leading = Math.floor(total / 2);
  return ' '.repeat(leading) + row + ' '.repeat(total - leading);
}

/**
 * Compose the ASCII building a domain has earned after `minutesFocused` of
 * undistracted focus (roadmap M2.T11c). Modules are unlocked by the data-driven
 * `BUILDING_UNLOCK_SCHEDULE`, each variant is chosen pseudo-randomly through the
 * injected `rng`. Pure and deterministic: same minutes + same seed → same
 * building, no internal `Date.now()`/`Math.random()` (principles D, §1.4).
 *
 * `moduleIds` are returned in unlock order (base → top), while `rows` are in
 * visual top-to-bottom order (the grid's row 0 is the top), so the composed
 * block can be written straight into a layer. A time at or above the last
 * threshold unlocks everything and never grows further.
 */
export function composeBuilding(
  minutesFocused: number,
  rng: SeededRandom,
): ComposedBuilding {
  const minutes = normalizeMinutes(minutesFocused);
  const selected: BuildingModule[] = [];

  for (const rule of BUILDING_UNLOCK_SCHEDULE) {
    if (rule.minuteThreshold > minutes) continue;
    const variants = getModulesByCategory(rule.moduleCategory);
    if (variants.length === 0) continue;
    const variant = variants[drawVariantIndex(rng, variants.length)];
    if (variant) selected.push(variant);
  }

  const widthChars = selected.reduce(
    (max, module) => Math.max(max, module.widthChars),
    0,
  );
  // The schedule unlocks bottom-up (base first, top last), so reversing yields
  // top element, upper floors, lower floors, base — the visual reading order.
  const topToBottom = [...selected].reverse();
  const rows = topToBottom.flatMap((module) =>
    module.rows.map((row) => padRow(row, widthChars)),
  );

  return {
    moduleIds: selected.map((module) => module.id),
    rows,
    widthChars,
  };
}
