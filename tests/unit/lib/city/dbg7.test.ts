import { describe, it } from 'vitest';
import { growCity, seedFromSession, GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import { composeBuilding } from '@/lib/city/building-composer';
import type { CityLayers } from '@/components/city/city.types';

const W = 40, H = 12;
const empty = (): CityLayers => ({
  background: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
  middleground: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
  foreground: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
});

describe('dbg7', () => {
  it('shows progression with row indices', () => {
    const seed = seedFromSession('1700000000000-abc');
    let layers = empty();
    const marks = [30, 150, 300, 600];
    let done = 0;
    for (const m of marks) {
      for (let i = done; i < m; i++) layers = growCity(layers, GROWTH_TICK_MS, seed);
      done = m;
      console.log(`=== ${m} ticks (${(m*2)/60} min) ===`);
      layers.middleground.cells.forEach((row, r) => {
        console.log(String(r).padStart(2) + '|' + row.map((c) => c.char ?? ' ').join('') + '|');
      });
    }
  });

  it('shows composed buildings', () => {
    for (const min of [0, 5, 10, 20, 25, 40]) {
      const b = composeBuilding(min, { next: () => 0.5 });
      console.log(`--- ${min} min (${b.rows.length} rows) ---`);
      for (const r of b.rows) console.log('|' + r + '|');
    }
  });
});
