import type { SessionSummary, Tag } from '@/store/store.types';

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
// anyway (M5.T1). `Record<string, never>` keeps the variant explicit while
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
// is untrusted (M5.T1).
interface TimerSetDurationMessage {
  readonly type: 'TIMER_SET_DURATION';
  readonly payload: { readonly durationSeconds: number };
}

// The overlay's answer for a blocked navigation (M2.T8). `tabId` is absent by
// design: the content script cannot know its own tab id without the `tabs`
// permission, and a caller-supplied id is untrusted anyway — the background
// derives it from `sender.tab.id` (M5.T1, whose payload part landed here).
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
// CR1.T2: there is no `list` discriminator — every site/tag mutation addresses
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

interface BlocklistApplyPresetMessage {
  readonly type: 'BLOCKLIST_APPLY_PRESET';
  readonly payload: { readonly presetId: string };
}

interface TagUpsertMessage {
  readonly type: 'TAG_UPSERT';
  readonly payload: Tag;
}

interface TagRemoveMessage {
  readonly type: 'TAG_REMOVE';
  readonly payload: { readonly tagId: string };
}

// Tag assignment (M3.T2): attach/detach a custom tag to a single site. `site`
// is untrusted (it may be a full URL) and goes through `normalizeEntry` on the
// background side, exactly like every other entry mutation (M2.T4/M2.T21).
interface TagAssignMessage {
  readonly type: 'TAG_ASSIGN';
  readonly payload: {
    readonly site: string;
    readonly tagId: string;
  };
}

interface TagUnassignMessage {
  readonly type: 'TAG_UNASSIGN';
  readonly payload: {
    readonly site: string;
    readonly tagId: string;
  };
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
  | BlocklistApplyPresetMessage
  | TagUpsertMessage
  | TagRemoveMessage
  | TagAssignMessage
  | TagUnassignMessage;

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
  'BLOCKLIST_ADD_SITE',
  'BLOCKLIST_REMOVE_SITE',
  'BLOCKLIST_APPLY_PRESET',
  'TAG_UPSERT',
  'TAG_REMOVE',
  'TAG_ASSIGN',
  'TAG_UNASSIGN',
  'TIMER_STARTED',
  'TIMER_PAUSED',
  'TIMER_RESET',
  'TIMER_SET_DURATION',
] as const satisfies ReadonlyArray<RuntimeMessage['type']>;

/** The mutation variants a read-only context may send to the background. */
export type MutationMessage = Extract<
  RuntimeMessage,
  { type: (typeof MUTATION_TYPES)[number] }
>;