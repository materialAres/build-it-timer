/**
 * FNV-1a (32-bit): a small, dependency-free, well-mixed string hash.
 *
 * The same input always produces the same 32-bit unsigned number, which is what
 * makes deterministic mappings stable across contexts and restarts — the
 * domain → color palette (M2.T13) and the session → theme biome (M2.T13b).
 * Not cryptographic; determinism and a reasonably even spread are the goals.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
