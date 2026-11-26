import type { SoundPreferencesPatch } from '@/lib/sound/sound-preferences';
import type { SoundPlayRequest } from '@/lib/sound/sound-player';
import type { SessionSummary } from '@/store/store.types';

interface TimerTickMessage {
  readonly type: 'TIMER_TICK';
  readonly payload: { readonly remainingSeconds: number };
}

// Timer transitions (M3.T3b). The popup is read-only (M1.T9), so it *requests*
// the transition and the background — the timer's owner — performs it on its own
// slice, which schedules/clears the alarm on the background's provider.
//
// The payloads are deliberately empty: the session id is minted by the
// background's `startTimer` (M2.T1), and a caller-supplied id would be untrusted
// anyway (M6.T1). `Record<string, never>` keeps the variant explicit while
// forbidding any field.
interface TimerStartedMessage {
  readonly type: 'TIMER_STARTED';
  readonly payload: Record<string, never>;
}

interface TimerPausedMessage {
  readonly type: 'TIMER_PAUSED';
  readonly payload: Record<string, never>;
}

interface TimerResetMessage {
  readonly type: 'TIMER_RESET';
  readonly payload: Record<string, never>;
}

// Session length (user-selectable focus duration). The popup is read-only
// (M1.T9), so it requests the change and the background — the timer's owner —
// validates it against the preset table and applies it. A caller-supplied value
// is untrusted (M6.T1).
interface TimerSetDurationMessage {
  readonly type: 'TIMER_SET_DURATION';
  readonly payload: { readonly durationSeconds: number };
}

// The overlay's answer for a blocked navigation (M2.T8). `tabId` is absent by
// design: the content script cannot know its own tab id without the `tabs`
// permission, and a caller-supplied id is untrusted anyway — the background
// derives it from `sender.tab.id` (M6.T1, whose payload part landed here).
interface SiteBlockedAttemptMessage {
  readonly type: 'SITE_BLOCKED_ATTEMPT';
  readonly payload: {
    readonly domain: string;
    readonly choice: 'proceed' | 'go-back';
  };
}

interface MalusAppliedMessage {
  readonly type: 'MALUS_APPLIED';
  readonly payload: { readonly domain: string; readonly charactersRemoved: number };
}

interface SessionEndedMessage {
  readonly type: 'SESSION_ENDED';
  readonly payload: SessionSummary;
}

// --- Cross-context mutations (M1.T10) -------------------------------------
// A read-only context (the popup) cannot write the persisted store (M1.T9), so
// it asks the background — the single writer — to apply the change. Only the
// transport is defined here: the CRUD semantics (normalization, dedup, "Enter a
// valid URL") belong to M2.T4/M2.T21.
//
// CR1.T2: there is no `list` discriminator — every site mutation addresses
// the single blocklist. A legacy sender still putting a `list` field in the
// payload is ignored, never used to select a collection.

interface BlocklistAddSiteMessage {
  readonly type: 'BLOCKLIST_ADD_SITE';
  readonly payload: { readonly site: string };
}

interface BlocklistRemoveSiteMessage {
  readonly type: 'BLOCKLIST_REMOVE_SITE';
  readonly payload: { readonly site: string };
}

// Preset mutations (CR4.T3, decisions in docs/features-analysis/saved-presets.md).
// `PRESET_TOGGLE` carries the explicit target state, never a flip, so a
// redelivered message cannot invert the result and the background can tell an
// add-direction request (`applied: true`) from a loosening one (CR5). For
// `PRESET_SAVE` the id is minted by the sender but the domains are not sent: the
// background snapshots its own blocklist, which stays authoritative.
interface PresetToggleMessage {
  readonly type: 'PRESET_TOGGLE';
  readonly payload: { readonly presetId: string; readonly applied: boolean };
}

interface PresetSaveMessage {
  readonly type: 'PRESET_SAVE';
  readonly payload: { readonly id: string; readonly name: string };
}

interface PresetRenameMessage {
  readonly type: 'PRESET_RENAME';
  readonly payload: { readonly presetId: string; readonly name: string };
}

interface PresetDeleteMessage {
  readonly type: 'PRESET_DELETE';
  readonly payload: { readonly presetId: string };
}

// Preferences (M5.T8). The patch is untrusted: `setSoundPreferences` validates
// it in the background, so the type only says what a well-behaved sender puts
// in. Not locked by the timer status.
interface PreferencesSoundSetMessage {
  readonly type: 'PREFERENCES_SOUND_SET';
  readonly payload: SoundPreferencesPatch;
}

// Sound playback (M5.T10). The background sends it to the offscreen page,
// which plays it. It is a command to one listener, not a request to change
// persisted state, so it is neither a mutation nor a background listener type.
interface PlaySoundMessage {
  readonly type: 'PLAY_SOUND';
  readonly payload: SoundPlayRequest;
}

export type RuntimeMessage =
  | TimerTickMessage
  | TimerStartedMessage
  | TimerPausedMessage
  | TimerResetMessage
  | TimerSetDurationMessage
  | SiteBlockedAttemptMessage
  | MalusAppliedMessage
  | SessionEndedMessage
  | BlocklistAddSiteMessage
  | BlocklistRemoveSiteMessage
  | PresetToggleMessage
  | PresetSaveMessage
  | PresetRenameMessage
  | PresetDeleteMessage
  | PreferencesSoundSetMessage
  | PlaySoundMessage;

/** The blocklist and preset mutations: the family the lock applies to. */
export const BLOCKLIST_MUTATION_TYPES = [
  'BLOCKLIST_ADD_SITE',
  'BLOCKLIST_REMOVE_SITE',
  'PRESET_TOGGLE',
  'PRESET_SAVE',
  'PRESET_RENAME',
  'PRESET_DELETE',
] as const satisfies ReadonlyArray<RuntimeMessage['type']>;

/** The timer commands (M3.T3b), applied through the background's timer slice. */
export const TIMER_MUTATION_TYPES = [
  'TIMER_STARTED',
  'TIMER_PAUSED',
  'TIMER_RESET',
  'TIMER_SET_DURATION',
] as const satisfies ReadonlyArray<RuntimeMessage['type']>;

/** The preferences mutations (M5.T8): never locked by the timer status. */
export const PREFERENCES_MUTATION_TYPES = [
  'PREFERENCES_SOUND_SET',
] as const satisfies ReadonlyArray<RuntimeMessage['type']>;

/**
 * The `type` values of `MutationMessage`, usable as a runtime list. Declared
 * first so the union below is *derived* from it: a variant added here is
 * automatically part of `MutationMessage`, and one omitted here can never be
 * handled by the background's mutation path.
 *
 * `TIMER_TICK` is intentionally absent: it is a passive notification the popup
 * emits on a fixed sampling cadence (M2.T15), not a request to change persisted
 * state.
 */
export const MUTATION_TYPES = [
  ...BLOCKLIST_MUTATION_TYPES,
  ...TIMER_MUTATION_TYPES,
  ...PREFERENCES_MUTATION_TYPES,
] as const satisfies ReadonlyArray<RuntimeMessage['type']>;

/** The mutation variants a read-only context may send to the background. */
export type MutationMessage = Extract<
  RuntimeMessage,
  { type: (typeof MUTATION_TYPES)[number] }
>;

/** The variants the blocklist lock applies to (CR2/CR5). */
export type BlocklistMutationMessage = Extract<
  RuntimeMessage,
  { type: (typeof BLOCKLIST_MUTATION_TYPES)[number] }
>;

/**
 * Whether a mutation belongs to the blocklist family, which is the one the
 * lock governs. Everything else is a timer command.
 */
export function isBlocklistMutation(
  message: MutationMessage,
): message is BlocklistMutationMessage {
  return (BLOCKLIST_MUTATION_TYPES as ReadonlyArray<string>).includes(
    message.type,
  );
}