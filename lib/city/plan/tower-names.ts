import type { TowerNameParts } from './city-plan.types';
import { pickWeighted, type SeededRandom } from './rng';

/** Landmark name parts (data): `PREFIX SUFFIX`, e.g. `NEO HELIX`. */
export const TOWER_NAME_PARTS: TowerNameParts = {
  prefixes: ['NEO', 'AXIOM', 'QUANTA', 'VANTA', 'ORBIT', 'HELIX', 'CIPHER', 'NOVA', 'ZENITH', 'PRISM', 'KERNEL', 'VECTOR'],
  suffixes: ['TOWER', 'PLAZA', 'SPIRE', 'HUB', 'CORE', 'ARRAY', 'NODE', 'DECK'],
};

/**
 * A name not in `used`, which receives it. When every combination is taken
 * (only possible with tiny custom data) a number is appended.
 */
export function pickTowerName(
  rng: SeededRandom,
  used: Set<string>,
  parts: TowerNameParts,
): string {
  const free = parts.prefixes
    .flatMap((prefix) => parts.suffixes.map((suffix) => `${prefix} ${suffix}`))
    .filter((name) => !used.has(name));
  const picked = pickWeighted(rng, free, () => 1);
  const name = picked ?? `LANDMARK ${String(used.size + 1)}`;
  used.add(name);
  return name;
}
