import { isUserPresetId } from '@/lib/blocking/saved-presets';
import { COMPLETION_BANDS } from '@/lib/score/completion-bands';
import { isSoundPlayRequest } from '@/lib/sound/sound-player';
import { isSoundVolume } from '@/lib/sound/sound-preferences';
import { isSoundThemeId } from '@/lib/sound/sound-themes';
import type { Result } from '@/utils/result';
import { err, ok } from '@/utils/result';
import type { RuntimeMessage } from './messages.types';

type MessageType = RuntimeMessage['type'];
type PayloadOf<T extends MessageType> = Extract<RuntimeMessage, { type: T }>['payload'];
type Fields = Readonly<Record<string, unknown>>;

/**
 * Runtime guards for every `RuntimeMessage` (M6.T1). The static union says
 * nothing about what a forged or stale sender put on the wire, so a message is
 * never cast: it is rebuilt field by field. What comes out is a *fresh* object
 * holding only the fields the variant declares, so an extra field (a forged
 * `tabId`, say) can never travel further than this module.
 *
 * Only the *shape* is checked. Domain rules (does the site normalize, is the
 * duration an offered preset, is the timer idle) stay with the consumers.
 */

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Own properties only: an inherited `site` from a polluted prototype is not a field.
const own = (fields: Fields, key: string): unknown =>
  Object.hasOwn(fields, key) ? fields[key] : undefined;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const COMPLETION_LEVELS: ReadonlyArray<unknown> = COMPLETION_BANDS.map(
  (band) => band.level,
);

const parseEmpty = (payload: Fields): Record<string, never> | undefined =>
  Object.keys(payload).length === 0 ? {} : undefined;

type PayloadParsers = {
  readonly [T in MessageType]: (payload: Fields) => PayloadOf<T> | undefined;
};

const PAYLOAD_PARSERS: PayloadParsers = {
  TIMER_TICK(payload) {
    const remainingSeconds = own(payload, 'remainingSeconds');
    return typeof remainingSeconds === 'number' && Number.isFinite(remainingSeconds)
      ? { remainingSeconds }
      : undefined;
  },
  // Empty by design: a caller-supplied field would be untrusted anyway.
  TIMER_STARTED: parseEmpty,
  TIMER_PAUSED: parseEmpty,
  TIMER_RESET: parseEmpty,
  TIMER_SET_DURATION(payload) {
    const durationSeconds = own(payload, 'durationSeconds');
    return Number.isInteger(durationSeconds)
      ? { durationSeconds: durationSeconds as number }
      : undefined;
  },
  SITE_BLOCKED_ATTEMPT(payload) {
    const domain = own(payload, 'domain');
    const choice = own(payload, 'choice');
    return typeof domain === 'string' && (choice === 'proceed' || choice === 'go-back')
      ? { domain, choice }
      : undefined;
  },
  MALUS_APPLIED(payload) {
    const domain = own(payload, 'domain');
    const charactersRemoved = own(payload, 'charactersRemoved');
    return typeof domain === 'string' &&
      typeof charactersRemoved === 'number' &&
      Number.isFinite(charactersRemoved)
      ? { domain, charactersRemoved }
      : undefined;
  },
  SESSION_ENDED(payload) {
    const sessionId = own(payload, 'sessionId');
    const score = own(payload, 'score');
    const population = own(payload, 'population');
    const endedAt = own(payload, 'endedAt');
    return typeof sessionId === 'string' &&
      COMPLETION_LEVELS.includes(score) &&
      typeof population === 'number' &&
      Number.isFinite(population) &&
      typeof endedAt === 'number' &&
      Number.isFinite(endedAt)
      ? {
          sessionId,
          score: score as PayloadOf<'SESSION_ENDED'>['score'],
          population,
          endedAt,
        }
      : undefined;
  },
  BLOCKLIST_ADD_SITE(payload) {
    const site = own(payload, 'site');
    return isNonEmptyString(site) ? { site } : undefined;
  },
  BLOCKLIST_REMOVE_SITE(payload) {
    const site = own(payload, 'site');
    return isNonEmptyString(site) ? { site } : undefined;
  },
  PRESET_TOGGLE(payload) {
    const presetId = own(payload, 'presetId');
    const applied = own(payload, 'applied');
    return isNonEmptyString(presetId) && typeof applied === 'boolean'
      ? { presetId, applied }
      : undefined;
  },
  PRESET_SAVE(payload) {
    const id = own(payload, 'id');
    const name = own(payload, 'name');
    return typeof id === 'string' && isUserPresetId(id) && typeof name === 'string'
      ? { id, name }
      : undefined;
  },
  PRESET_RENAME(payload) {
    const presetId = own(payload, 'presetId');
    const name = own(payload, 'name');
    return isNonEmptyString(presetId) && typeof name === 'string'
      ? { presetId, name }
      : undefined;
  },
  PRESET_DELETE(payload) {
    const presetId = own(payload, 'presetId');
    return isNonEmptyString(presetId) ? { presetId } : undefined;
  },
  PREFERENCES_SOUND_SET(payload) {
    const patch: { enabled?: boolean; themeId?: PayloadOf<'PLAY_SOUND'>['themeId']; volume?: number } = {};
    const enabled = own(payload, 'enabled');
    const themeId = own(payload, 'themeId');
    const volume = own(payload, 'volume');
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') return undefined;
      patch.enabled = enabled;
    }
    if (themeId !== undefined) {
      if (!isSoundThemeId(themeId)) return undefined;
      patch.themeId = themeId;
    }
    if (volume !== undefined) {
      if (!isSoundVolume(volume)) return undefined;
      patch.volume = volume;
    }
    return Object.keys(patch).length === 0 ? undefined : patch;
  },
  PLAY_SOUND(payload) {
    if (!isSoundPlayRequest(payload)) return undefined;
    const { themeId, cue, volume } = payload;
    return { themeId, cue, volume };
  },
};

function parseUnsafe(raw: unknown): Result<RuntimeMessage> {
  if (!isFields(raw)) return err(new Error('message is not an object'));
  const type = own(raw, 'type');
  if (typeof type !== 'string' || !Object.hasOwn(PAYLOAD_PARSERS, type)) {
    return err(new Error('unknown message type'));
  }
  const payload = own(raw, 'payload');
  if (!isFields(payload)) return err(new Error(`${type}: payload is not an object`));

  const parse = PAYLOAD_PARSERS[type as MessageType] as (
    fields: Fields,
  ) => RuntimeMessage['payload'] | undefined;
  const parsed = parse(payload);
  return parsed === undefined
    ? err(new Error(`${type}: malformed payload`))
    : ok({ type, payload: parsed } as RuntimeMessage);
}

/**
 * Validates an incoming message and returns a fresh, known-fields-only copy.
 * Total (§1.4): any failure, including a hostile getter or proxy that throws,
 * is an `err`, never an exception. The error names the type at most, never the
 * payload.
 */
export function parseRuntimeMessage(raw: unknown): Result<RuntimeMessage> {
  try {
    return parseUnsafe(raw);
  } catch (error: unknown) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
