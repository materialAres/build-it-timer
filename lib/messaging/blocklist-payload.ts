import type { MutationMessage } from './messages.types';

/** The mutation variants that change the blocklist (sites and presets). */
export type BlocklistMutation = Extract<
  MutationMessage,
  {
    type:
      | 'BLOCKLIST_ADD_SITE'
      | 'BLOCKLIST_REMOVE_SITE'
      | 'PRESET_TOGGLE'
      | 'PRESET_SAVE'
      | 'PRESET_RENAME'
      | 'PRESET_DELETE';
  }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Whether a blocklist mutation's payload has the shape its type declares
 * (CR4.T4). Messages cross an untrusted boundary (M5.T1): the static type says
 * nothing about what a forged or stale sender put on the wire, so every field
 * is checked at runtime. Only the *shape* is checked here — whether a site
 * normalizes, a preset exists or a name is free is the pure helpers' decision,
 * and a well-formed request they refuse is a no-op, not a malformed message.
 *
 * Total (§1.4): never throws, whatever the payload is.
 */
export function isWellFormedBlocklistMutation(
  message: BlocklistMutation,
): boolean {
  const payload: unknown = message.payload;
  if (!isRecord(payload)) return false;

  switch (message.type) {
    case 'BLOCKLIST_ADD_SITE':
    case 'BLOCKLIST_REMOVE_SITE':
      return isNonEmptyString(payload.site);
    case 'PRESET_TOGGLE':
      return (
        isNonEmptyString(payload.presetId) &&
        typeof payload.applied === 'boolean'
      );
    case 'PRESET_SAVE':
      return isNonEmptyString(payload.id) && typeof payload.name === 'string';
    case 'PRESET_RENAME':
      return (
        isNonEmptyString(payload.presetId) && typeof payload.name === 'string'
      );
    case 'PRESET_DELETE':
      return isNonEmptyString(payload.presetId);
  }
}

/**
 * Whether a blocklist mutation can only *tighten* the list (CR5.T2): adding a
 * site, or switching a preset on. These are the only requests the add-only
 * window lets through mid-session; everything else loosens or reshapes the list
 * and stays `idle`-only. Read from the raw payload and total, because the lock
 * is decided *before* the payload is trusted: a toggle whose `applied` is not
 * exactly `true` is never add-direction, so a forged target cannot widen the
 * window.
 */
export function isAddDirectionMutation(message: BlocklistMutation): boolean {
  if (message.type === 'BLOCKLIST_ADD_SITE') return true;
  if (message.type !== 'PRESET_TOGGLE') return false;
  const payload: unknown = message.payload;
  return isRecord(payload) && payload.applied === true;
}
