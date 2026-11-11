/** A deterministic PRNG: the same seed always gives the same sequence. */
export interface SeededRandom {
  /** A float in [0, 1). */
  readonly next: () => number;
}

/**
 * mulberry32: a tiny 32-bit generator with a good spread. Not cryptographic;
 * determinism is the goal (§1.4: no `Math.random()` in `lib/`). Total: a
 * non-finite seed behaves like 0.
 */
export function createRng(seed: number): SeededRandom {
  let state = Number.isFinite(seed) ? seed >>> 0 : 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** An integer in [min, max], both included; `min` when the range is empty. */
export function nextInt(rng: SeededRandom, min: number, max: number): number {
  // `+ 0` turns a -0 bound into 0 so equal inputs give deep-equal outputs.
  if (max <= min) return min + 0;
  return min + Math.floor(rng.next() * (max - min + 1));
}

/**
 * One item chosen with probability proportional to its weight; items with a
 * non-positive weight are never chosen. `undefined` when none can be.
 */
export function pickWeighted<T>(
  rng: SeededRandom,
  items: ReadonlyArray<T>,
  weightOf: (item: T) => number,
): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  if (!(total > 0)) return undefined;
  let remaining = rng.next() * total;
  let last: T | undefined;
  for (const item of items) {
    const weight = Math.max(0, weightOf(item));
    if (weight === 0) continue;
    last = item;
    remaining -= weight;
    if (remaining < 0) return item;
  }
  return last;
}
