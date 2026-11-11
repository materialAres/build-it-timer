import { describe, expect, it } from 'vitest';
import {
  CAMERA_HOME,
  CAMERA_TARGET,
  ORBIT_LIMITS,
  VIEW_SIZE,
  frustumFor,
  orbitAnglesOf,
} from '@/lib/city/camera-framing';
import { GROUND_DEPTH, GROUND_WIDTH } from '@/lib/city/plan/limits';

describe('camera framing (CR6.T6a)', () => {
  it('builds a symmetric frustum of the fixed view height', () => {
    const f = frustumFor(2);
    expect(f.top).toBe(VIEW_SIZE / 2);
    expect(f.bottom).toBe(-VIEW_SIZE / 2);
    expect(f.right).toBe(VIEW_SIZE);
    expect(f.left).toBe(-VIEW_SIZE);
  });

  it('widens with the aspect ratio and keeps the height', () => {
    expect(frustumFor(3).right).toBeGreaterThan(frustumFor(1).right);
    expect(frustumFor(3).top).toBe(frustumFor(1).top);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('falls back to a square for aspect %s', (aspect) => {
    expect(frustumFor(aspect)).toEqual(frustumFor(1));
  });

  it('shows the whole ground at the narrowest popup-like aspect', () => {
    const diagonal = Math.hypot(GROUND_WIDTH, GROUND_DEPTH);
    expect(frustumFor(1).right * 2).toBeGreaterThanOrEqual(diagonal * 0.9);
  });

  it('starts inside its own orbit limits', () => {
    const { polar, azimuth } = orbitAnglesOf(CAMERA_HOME, CAMERA_TARGET);
    expect(polar).toBeGreaterThanOrEqual(ORBIT_LIMITS.minPolar);
    expect(polar).toBeLessThanOrEqual(ORBIT_LIMITS.maxPolar);
    expect(azimuth).toBeGreaterThanOrEqual(ORBIT_LIMITS.minAzimuth);
    expect(azimuth).toBeLessThanOrEqual(ORBIT_LIMITS.maxAzimuth);
  });

  it('limits the orbit and the zoom, with no pan', () => {
    expect(ORBIT_LIMITS.maxAzimuth - ORBIT_LIMITS.minAzimuth).toBeLessThan(Math.PI);
    expect(ORBIT_LIMITS.minZoom).toBeLessThan(1);
    expect(ORBIT_LIMITS.maxZoom).toBeGreaterThan(1);
    expect(ORBIT_LIMITS.maxPolar).toBeLessThan(Math.PI / 2);
  });
});
