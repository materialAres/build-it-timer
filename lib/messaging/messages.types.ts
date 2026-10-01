import type { SessionSummary, Tag } from '@/store/store.types';

interface TimerTickMessage {
  readonly type: 'TIMER_TICK';
  readonly payload: { readonly remainingSeconds: number };
}

interface TimerStartedMessage {
  readonly type: 'TIMER_STARTED';
  readonly payload: { readonly sessionId: string };
}

interface TimerPausedMessage {
  readonly type: 'TIMER_PAUSED';
  readonly payload: Record<string, never>; // no payload but explicit
}

interface SiteBlockedAttemptMessage {
  readonly type: 'SITE_BLOCKED_ATTEMPT';
  readonly payload: {
    readonly domain: string;
    readonly choice: 'proceed' | 'go-back';
    readonly tabId: number;
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
// transport is defined here: the CRUD semantics (normalization, dedup,
// allowlist precedence, "Enter a valid URL") belong to M2.T4/M2.T20/M2.T21.
//
// `list` discriminates which collection is addressed. `allowlist` wins over
// `blocklist` when the same canonical domain is present in both (M2.T6/M2.T20).

interface BlocklistAddSiteMessage {
  readonly type: 'BLOCKLIST_ADD_SITE';
  readonly payload: { readonly list: 'allowlist' | 'blocklist'; readonly site: string };
}

interface BlocklistRemoveSiteMessage {
  readonly type: 'BLOCKLIST_REMOVE_SITE';
  readonly payload: { readonly list: 'allowlist' | 'blocklist'; readonly site: string };
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

export type RuntimeMessage =
  | TimerTickMessage
  | TimerStartedMessage
  | TimerPausedMessage
  | SiteBlockedAttemptMessage
  | MalusAppliedMessage
  | SessionEndedMessage
  | BlocklistAddSiteMessage
  | BlocklistRemoveSiteMessage
  | BlocklistApplyPresetMessage
  | TagUpsertMessage
  | TagRemoveMessage;

/** The mutation variants a read-only context may send to the background. */
export type MutationMessage = Extract<
  RuntimeMessage,
  { type: `BLOCKLIST_${string}` | `TAG_${string}` }
>;

/** The `type` values of `MutationMessage`, usable as a runtime list. */
export const MUTATION_TYPES = [
  'BLOCKLIST_ADD_SITE',
  'BLOCKLIST_REMOVE_SITE',
  'BLOCKLIST_APPLY_PRESET',
  'TAG_UPSERT',
  'TAG_REMOVE',
] as const satisfies ReadonlyArray<MutationMessage['type']>;