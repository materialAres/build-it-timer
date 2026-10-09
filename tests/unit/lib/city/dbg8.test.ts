import { describe, it } from 'vitest';
import { growCity, seedFromSession, GROWTH_TICK_MS } from '@/lib/city/growth-engine';
import type { CityLayers } from '@/components/city/city.types';

const W = 40, H = 12;
const empty = (): CityLayers => ({
  background: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
  middleground: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
  foreground: { width: W, height: H, cells: Array.from({length: H}, () => Array.from({length: W}, () => ({ char: null as string | null }))) },
});

const count = (g: { cells: readonly (readonly { char: string | null }[])[] }) =>
  g.cells.reduce((n, r) => n + r.filter((c) => c.char !== null).length, 0);

describe('dbg8', () => {
  it('counts per layer', () => {
    const seed = seedFromSession('1700000000000-abc');
    let layers = empty();
    for (let i = 0; i < 600; i++) {
      layers = growCity(layers, GROWTH_TICK_MS, seed);
      if (i % 100 === 99) {
        console.log(`tick ${i + 1}: bg=${count(layers.background)} mid=${count(layers.middleground)} fg=${count(layers.foreground)}`);
      }
    }
    for (const name of ['background', 'middleground', 'foreground'] as const) {
      console.log(`=== ${name} ===`);
      layers[name].cells.forEach((row, r) => {
        console.log(String(r).padStart(2) + '|' + row.map((c) => c.char ?? ' ').join('') + '|');
      });
    }
  });
});
