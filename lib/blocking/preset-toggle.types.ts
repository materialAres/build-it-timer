import type { Domain } from '@/store/store.types';

/**
 * The part of a preset the toggle logic needs (CR4.T2). Built-in presets
 * (`PRESETS`) already satisfy it; the `tag` they still carry is ignored and
 * disappears when CR4.T3 flips the store model.
 */
export interface PresetShape {
  readonly id: string;
  readonly name: string;
  readonly domains: ReadonlyArray<Domain>;
}

/**
 * A blocklist entry that records where it came from (CR4.T1 §3.1). Invariant:
 * `manual || presetIds.length > 0` — an entry that loses its last source is
 * deleted by the logic that removed it.
 */
export interface SourcedEntry {
  readonly domain: Domain;
  /** The user typed it (or kept it) themselves. */
  readonly manual: boolean;
  /** Ids of the applied presets, built-in or user, that contributed it. */
  readonly presetIds: ReadonlyArray<string>;
}

/**
 * The blocklist model after CR4 (CR4.T1 §3.2). The applied set is explicit —
 * not derived from the entries — so an empty preset, or one whose last domain
 * was removed with ×, keeps its state. CR4.T3 makes the persisted
 * `BlocklistState` this shape.
 */
export interface PresetBlocklistState {
  readonly blocklist: ReadonlyArray<SourcedEntry>;
  readonly appliedPresetIds: ReadonlyArray<string>;
  readonly userPresets: ReadonlyArray<PresetShape>;
}

/** How many of a preset's domains the list currently carries as its own. */
export interface PresetCoverage {
  readonly covered: number;
  readonly total: number;
}
