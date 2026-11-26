import { createRng } from '@/lib/city/plan/rng';

const MIN_BITS = 2;
const MAX_BITS = 8;
const DEFAULT_CURVE_SIZE = 4096;

/** Deterministic white noise in [-1, 1]; the seed replaces `Math.random`. */
export function calculateNoiseSamples(length: number, seed: number): Float32Array {
  const count = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  const rng = createRng(seed);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    samples[index] = rng.next() * 2 - 1;
  }
  return samples;
}

// A non-finite depth keeps the finest setting: the least audible degradation.
function clampBits(bits: number): number {
  if (!Number.isFinite(bits)) return MAX_BITS;
  return Math.min(MAX_BITS, Math.max(MIN_BITS, Math.round(bits)));
}

/**
 * The `WaveShaperNode.curve` that snaps the input range [-1, 1] onto
 * `2 ** bits` evenly spaced output levels (a bit-crush).
 */
export function calculateBitcrushCurve(
  bits: number,
  size: number = DEFAULT_CURVE_SIZE,
): Float32Array {
  const levels = 2 ** clampBits(bits);
  const length = Math.max(2, Math.floor(size));
  const curve = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const level = Math.round((index / (length - 1)) * (levels - 1));
    curve[index] = -1 + (2 * level) / (levels - 1);
  }
  return curve;
}
