import type { BuildingShape, GroundPlan, PropShape, Section } from './city-plan.types';
import {
  MAX_BEACONS,
  MAX_LAMPS,
  MAX_SIGNS,
  MIN_SIGN_BUILDING_LEVELS,
  MIN_SIGN_SPAN,
  SIGN_SPAN_SHARE,
} from './limits';
import { nextInt, shuffled, type SeededRandom } from './rng';

const LAMP_CHANCE = 0.3;
const SIGN_CHANCE = 1 / 4;
/** How far along its face a sign stands, towards the corner nearest the camera. */
const SIGN_ALONG = 0.75;

function lamps(ground: GroundPlan, rng: SeededRandom): PropShape[] {
  const cells = new Map<string, { x: number; z: number }>();
  for (const road of ground.roads) {
    for (let x = road.x; x < road.x + road.w; x += 1) {
      for (let z = road.z; z < road.z + road.d; z += 1) {
        cells.set(`${String(x)},${String(z)}`, { x, z });
      }
    }
  }
  return [...cells.values()]
    .filter(() => rng.next() < LAMP_CHANCE)
    .slice(0, MAX_LAMPS)
    .map(({ x, z }) => ({ kind: 'lamp', x: x + 0.5, z: z + 0.5, level: 0, building: null }));
}

/** The ground section whose face on `side` is the outermost: the one the camera sees. */
function faceSection(b: BuildingShape, side: 'x' | 'z'): Section | undefined {
  const face = (s: Section): number => (side === 'x' ? s.rect.x + s.rect.w : s.rect.z + s.rect.d);
  return b.sections
    .filter((s) => s.fromLevel === 0)
    .reduce<Section | undefined>((best, s) => (best === undefined || face(s) > face(best) ? s : best), undefined);
}

function signOf(b: BuildingShape, rng: SeededRandom): PropShape | null {
  const side = rng.next() < 0.5 ? 'x' : 'z';
  const section = faceSection(b, side);
  if (section === undefined || section.toLevel < MIN_SIGN_BUILDING_LEVELS) return null;
  const height = section.toLevel;
  const share = SIGN_SPAN_SHARE.min + rng.next() * (SIGN_SPAN_SHARE.max - SIGN_SPAN_SHARE.min);
  const span = Math.min(height, Math.max(MIN_SIGN_SPAN, Math.round(height * share)));
  const level = nextInt(rng, Math.min(1, height - span), height - span);
  const { x, z, w, d } = section.rect;
  return side === 'x'
    ? { kind: 'sign', x: x + w, z: z + d * SIGN_ALONG, level, span, side, building: b.id }
    : { kind: 'sign', x: x + w * SIGN_ALONG, z: z + d, level, span, side, building: b.id };
}

/** Vertical neon signs on a quarter of the ordinary buildings tall enough; landmarks and spires have beacons. */
function signs(buildings: ReadonlyArray<BuildingShape>, rng: SeededRandom): PropShape[] {
  return shuffled(rng, buildings.filter((b) => !b.landmark && b.archetypeId !== 'spire'))
    .filter(() => rng.next() < SIGN_CHANCE)
    .flatMap((b) => {
      const sign = signOf(b, rng);
      return sign === null ? [] : [sign];
    })
    .slice(0, MAX_SIGNS);
}

function beacons(
  ground: GroundPlan,
  buildings: ReadonlyArray<BuildingShape>,
): PropShape[] {
  return buildings
    .filter((b) => b.landmark || b.archetypeId === 'spire')
    .sort((a, b) => Number(b.landmark) - Number(a.landmark))
    .slice(0, MAX_BEACONS)
    .flatMap((b) => {
      const lot = ground.lots[b.lotId];
      if (lot === undefined) return [];
      return [{ kind: 'beacon' as const, x: lot.x + lot.w / 2, z: lot.z + lot.d / 2, level: b.height, building: b.id }];
    });
}

/**
 * Street lamps along the roads, signs on about a third of the buildings and
 * beacons on landmarks and spires (landmarks first), each under its cap.
 */
export function placeProps(
  ground: GroundPlan,
  buildings: ReadonlyArray<BuildingShape>,
  rng: SeededRandom,
): PropShape[] {
  return [...lamps(ground, rng), ...signs(buildings, rng), ...beacons(ground, buildings)];
}
