import { browser } from 'wxt/browser';
import type { BlocklistEntry, TimerStatus } from '@/store/store.types';
import { buildDnrRules, type DnrRule } from './rules';

/**
 * The part of the app state the active rule set is derived from, declared
 * structurally so this module does not depend on the concrete store shape.
 */
export interface BlockingRulesSource {
  readonly timer: { readonly status: TimerStatus };
  readonly blocklist: {
    readonly allowlist: ReadonlyArray<BlocklistEntry>;
    readonly blocklist: ReadonlyArray<BlocklistEntry>;
  };
}

/**
 * Port over the browser's dynamic ruleset (dependency inversion, principle D):
 * the sync logic below never touches `browser.declarativeNetRequest` directly,
 * so it can be unit-tested with a recording fake (principle L).
 */
export interface RuleApplier {
  /** Replace the currently active dynamic rules with exactly `rules`. */
  replaceRules(rules: ReadonlyArray<DnrRule>): Promise<void>;
}

/**
 * Real `RuleApplier` backed by `browser.declarativeNetRequest`.
 *
 * The live ruleset is read back on every update instead of trusting an
 * in-memory list of "what we added": dynamic rules survive a service worker
 * restart **and** a browser restart, so after a cold start the browser is the
 * only record of what is currently active.
 */
export function createBrowserRuleApplier(): RuleApplier {
  return {
    async replaceRules(rules: ReadonlyArray<DnrRule>): Promise<void> {
      const existing = await browser.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = existing.map((rule) => rule.id);
      // Empty arrays are omitted rather than passed as `[]`: an empty rule set
      // only needs the removals, and a no-op update must stay a no-op.
      await browser.declarativeNetRequest.updateDynamicRules({
        ...(removeRuleIds.length > 0 ? { removeRuleIds } : {}),
        ...(rules.length > 0 ? { addRules: [...rules] } : {}),
      });
    },
  };
}

/**
 * Rules that must be active for a given state (M2.T7).
 *
 * Blocking is on **exclusively** during a running session: outside a focus
 * session the blocklist is carried in the store but never enforced, so
 * navigation is always free.
 */
export function selectActiveRules(state: BlockingRulesSource): DnrRule[] {
  if (state.timer.status !== 'running') return [];
  return buildDnrRules(state.blocklist.blocklist, state.blocklist.allowlist);
}

/**
 * Identity of a rule set, used to skip redundant browser calls: a timer tick or
 * any other state change that does not alter the resulting rules must not touch
 * `updateDynamicRules`.
 */
function rulesSignature(rules: ReadonlyArray<DnrRule>): string {
  return JSON.stringify(rules.map((rule) => [rule.id, rule.condition.urlFilter ?? null]));
}

export interface BlockingRulesSync {
  /** Make the browser's dynamic ruleset match `state`. Idempotent. */
  sync(state: BlockingRulesSource): Promise<void>;
}

/**
 * Keeps the browser's dynamic ruleset aligned with the store (M2.T7).
 *
 * `appliedSignature` starts as `null` rather than as the signature of an empty
 * rule set, because on a cold start the extension does not know what the
 * browser still has active — the first sync therefore always writes, which is
 * also what clears leftovers from a previous session.
 *
 * Updates are serialized: the popup's mutation path and the timer transitions
 * can trigger two syncs in the same tick, and an interleaved pair could
 * otherwise land out of order and leave the ruleset describing the older state.
 */
export function createBlockingRulesSync(applier: RuleApplier): BlockingRulesSync {
  let appliedSignature: string | null = null;
  let queue: Promise<void> = Promise.resolve();

  const apply = async (state: BlockingRulesSource): Promise<void> => {
    const rules = selectActiveRules(state);
    const signature = rulesSignature(rules);
    if (signature === appliedSignature) return;

    await applier.replaceRules(rules);
    // Only after a successful write: a failed update must be retried by the
    // next sync instead of being remembered as applied.
    appliedSignature = signature;
  };

  return {
    sync(state: BlockingRulesSource): Promise<void> {
      const run = queue.then(() => apply(state));
      // The chain must survive a rejection, while the returned promise still
      // rejects so the caller can log it.
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
