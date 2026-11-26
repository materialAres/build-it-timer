import { describe, expect, it } from 'vitest';
import {
  calculateBitcrushCurve,
  calculateNoiseSamples,
} from '@/lib/sound/waveshapes';

describe('calculateNoiseSamples', () => {
  it('returns the requested length with every value in [-1, 1]', () => {
    const samples = calculateNoiseSamples(1000, 7);
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples).toHaveLength(1000);
    for (const value of samples) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is not silent', () => {
    const samples = calculateNoiseSamples(1000, 7);
    expect(samples.some((value) => value !== 0)).toBe(true);
  });

  it('gives the same array for the same seed', () => {
    expect(calculateNoiseSamples(256, 42)).toEqual(calculateNoiseSamples(256, 42));
  });

  it('gives different arrays for different seeds', () => {
    expect(calculateNoiseSamples(256, 1)).not.toEqual(calculateNoiseSamples(256, 2));
  });

  it.each([
    [0, 0],
    [-5, 0],
    [Number.NaN, 0],
    [10.9, 10],
  ])('treats length %s as %s samples', (length, expected) => {
    expect(calculateNoiseSamples(length, 1)).toHaveLength(expected);
  });
});

describe('calculateBitcrushCurve', () => {
  it('has the requested size, starts at -1 and ends at 1', () => {
    const curve = calculateBitcrushCurve(4);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve).toHaveLength(4096);
    expect(curve[0]).toBe(-1);
    expect(curve[curve.length - 1]).toBe(1);
  });

  it('honours a custom size', () => {
    expect(calculateBitcrushCurve(4, 1024)).toHaveLength(1024);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])('has exactly 2 ** %s distinct levels', (bits) => {
    const curve = calculateBitcrushCurve(bits);
    expect(new Set(curve).size).toBe(2 ** bits);
  });

  it.each([2, 5, 8])('never decreases (%s bits)', (bits) => {
    const curve = calculateBitcrushCurve(bits);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index] ?? 0).toBeGreaterThanOrEqual(curve[index - 1] ?? 0);
    }
  });

  it('spaces the levels evenly', () => {
    const levels = [...new Set(calculateBitcrushCurve(3))];
    const step = (levels[1] ?? 0) - (levels[0] ?? 0);
    for (let index = 1; index < levels.length; index += 1) {
      const gap = (levels[index] ?? 0) - (levels[index - 1] ?? 0);
      expect(gap).toBeCloseTo(step, 5);
    }
  });

  it.each([
    [1, 2],
    [0, 2],
    [-3, 2],
    [12, 8],
  ])('clamps bits %s to %s', (bits, clamped) => {
    expect(new Set(calculateBitcrushCurve(bits)).size).toBe(2 ** clamped);
  });

  it('treats non-finite bits as the finest setting', () => {
    expect(new Set(calculateBitcrushCurve(Number.NaN)).size).toBe(2 ** 8);
  });
});
