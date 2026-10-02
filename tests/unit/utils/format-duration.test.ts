import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/utils/format-duration';

describe('formatDuration', () => {
  it('formats zero as 00:00:00', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  it('formats seconds with zero-padded minutes and hours', () => {
    expect(formatDuration(5)).toBe('00:00:05');
    expect(formatDuration(65)).toBe('00:01:05');
  });

  it('formats a full 25-minute session', () => {
    expect(formatDuration(25 * 60)).toBe('00:25:00');
  });

  it('formats exactly one hour', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
  });

  it('formats values beyond one hour', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(2 * 3600 + 30 * 60 + 9)).toBe('02:30:09');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(59.9)).toBe('00:00:59');
  });

  it('clamps negative values to zero', () => {
    expect(formatDuration(-10)).toBe('00:00:00');
  });

  it('renders non-finite values as 00:00:00 instead of NaN', () => {
    expect(formatDuration(NaN)).toBe('00:00:00');
    expect(formatDuration(Infinity)).toBe('00:00:00');
    expect(formatDuration(-Infinity)).toBe('00:00:00');
  });

  it('renders null/undefined (untyped callers) as 00:00:00', () => {
    expect(formatDuration(null as unknown as number)).toBe('00:00:00');
    expect(formatDuration(undefined as unknown as number)).toBe('00:00:00');
  });
});
