import { describe, expect, it } from 'vitest';
import { createRng, nextInt, pickWeighted, shuffled } from '@/lib/city/plan/rng';

describe('createRng (CR6.T2a)', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('gives different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is total: a non-finite seed behaves like seed 0', () => {
    expect(createRng(Number.NaN).next()).toBe(createRng(0).next());
  });
});

describe('nextInt (CR6.T2a)', () => {
  it('covers every integer of an inclusive range and nothing else', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(nextInt(rng, -1, 1));
    expect([...seen].sort()).toEqual([-1, 0, 1]);
  });

  it('returns the bound for an empty or inverted range', () => {
    const rng = createRng(3);
    expect(nextInt(rng, 5, 5)).toBe(5);
    expect(nextInt(rng, 5, 2)).toBe(5);
  });
});

describe('pickWeighted (CR6.T2a)', () => {
  it('never picks a zero-weight item and follows the weights', () => {
    const rng = createRng(9);
    const items = [
      { id: 'a', weight: 0 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 3 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const picked = pickWeighted(rng, items, (item) => item.weight);
      counts[picked?.id ?? 'a'] = (counts[picked?.id ?? 'a'] ?? 0) + 1;
    }
    expect(counts.a).toBe(0);
    expect(counts.c).toBeGreaterThan(counts.b ?? 0);
  });

  it('returns undefined when no item has a positive weight', () => {
    const none: number[] = [];
    const noWeight = pickWeighted(createRng(1), none, () => 1);
    const zeroWeight = pickWeighted(createRng(1), [1], () => 0);
    expect(noWeight).toBeUndefined();
    expect(zeroWeight).toBeUndefined();
  });
});

describe('shuffled (CR6.T2b)', () => {
  it('returns a permutation, the same one for the same seed, leaving the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffled(createRng(5), input);
    expect([...a].sort()).toEqual(input);
    expect(shuffled(createRng(5), input)).toEqual(a);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('does not always return the same order', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) => shuffled(createRng(seed), input).join()),
    );
    expect(orders.size).toBeGreaterThan(10);
  });
});
