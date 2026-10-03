import type { DnrRule } from '@/lib/blocking/rules';
import type { RuleApplier } from '@/lib/blocking/apply-rules';

/**
 * Recording `RuleApplier` for tests. It honors the same contract as the real
 * `browser.declarativeNetRequest` implementation (principle L) but keeps the
 * "live" ruleset in memory, so tests can assert on the sequence of applied rule
 * sets without a browser. Lives under `tests/` so it never reaches the bundle.
 */
export class FakeRuleApplier implements RuleApplier {
  /** Every rule set passed to `replaceRules`, in call order. */
  readonly applied: DnrRule[][] = [];

  /** The rules currently "active" in the fake ruleset. */
  get activeRules(): ReadonlyArray<DnrRule> {
    return this.applied.at(-1) ?? [];
  }

  replaceRules(rules: ReadonlyArray<DnrRule>): Promise<void> {
    this.applied.push([...rules]);
    return Promise.resolve();
  }
}
