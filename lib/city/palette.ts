import { getRegistrableDomain } from '@/lib/url/domain';

/**
 * The default building palette (roadmap M2.T13): blue, orange, green, yellow.
 * Kept as data, not hardwired into the hash logic, so a theme (M2.T13b) can
 * pass its own `Theme.palette` to `getBuildingColor` without touching this
 * module (Open/Closed, §1.1).
 */
export const DEFAULT_BUILDING_PALETTE: ReadonlyArray<string> = [
  '#4dabf7', // blue
  '#ff9f43', // orange
  '#51cf66', // green
  '#fcc419', // yellow
];

/** Deterministic fallback for the degenerate empty-palette input. */
const FALLBACK_COLOR = '#4dabf7';

/**
 * FNV-1a (32-bit). A small, dependency-free, well-mixed string hash: the same
 * domain always produces the same number, so the palette assignment is stable
 * across sessions and contexts. Not cryptographic — determinism is the goal.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Canonical key for a domain: the registrable form (eTLD+1, subdomains
 * removed) in lowercase, so `www.facebook.com` and `m.facebook.com` share a
 * color (same building). Reuses the single M1.T2 normalizer (DRY). Input that
 * cannot be normalized (empty, malformed, bare public suffix) falls back to the
 * trimmed raw string so the function stays total (untrusted boundary, §1.4).
 */
function normalizeDomainKey(domain: string): string {
  const trimmed = domain.trim();
  if (trimmed.length === 0) return '';

  const normalized = getRegistrableDomain(trimmed);
  return (normalized.ok ? normalized.value : trimmed).toLowerCase();
}

/**
 * Deterministically maps a domain to a color from `palette`
 * (roadmap M2.T13). Same normalized domain → same color, always.
 *
 * The palette is a parameter, not a hardwired set, so the active theme
 * (M2.T13b) can supply its own; `DEFAULT_BUILDING_PALETTE` is used otherwise.
 */
export function getBuildingColor(
  domain: string,
  palette: ReadonlyArray<string> = DEFAULT_BUILDING_PALETTE,
): string {
  if (palette.length === 0) return FALLBACK_COLOR;

  const index = hashString(normalizeDomainKey(domain)) % palette.length;
  return palette[index] ?? FALLBACK_COLOR;
}
