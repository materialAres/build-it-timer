import { browser, type Browser } from 'wxt/browser';

type DnrRule = Browser.declarativeNetRequest.Rule;
type UpdateRuleOptions = Browser.declarativeNetRequest.UpdateRuleOptions;

/**
 * In-memory `browser.declarativeNetRequest` dynamic ruleset for tests.
 *
 * `fakeBrowser` declares the namespace but implements none of it: every method
 * throws `MockNotImplementedError`. The background, however, syncs the ruleset
 * on startup and on every store change (M2.T7), so without this fake every test
 * that calls `startBackground()` would reject through the production applier and
 * log an error at the known boundary — noise that hides real failures and means
 * `handle.ready` resolves through a caught rejection instead of a working sync.
 *
 * The methods are replaced rather than spied on because both are overloaded
 * (promise + callback form), which makes `vi.spyOn(...).mockImplementation()`
 * resolve against the void-returning overload.
 */
export interface FakeDynamicRules {
  /** Every rule update received, in call order. Mutable so tests can truncate it. */
  readonly updates: UpdateRuleOptions[];
  /** The rules currently "active" in the fake ruleset. */
  liveRules(): DnrRule[];
  /** Make every ruleset read reject, to exercise the error boundary (§1.4). */
  fail(error?: Error): void;
  /** Stop failing and restore the in-memory implementation. */
  recover(): void;
  /** Clear the recorded updates, the live ruleset and the failure flag. */
  reset(): void;
}

let liveRules: DnrRule[] = [];
let updates: UpdateRuleOptions[] = [];
let failure: Error | null = null;

const handle: FakeDynamicRules = {
  // Getters, so the arrays stay valid across `reset()`.
  get updates(): UpdateRuleOptions[] {
    return updates;
  },
  liveRules: () => [...liveRules],
  fail(error = new Error('declarativeNetRequest unavailable')): void {
    failure = error;
  },
  recover(): void {
    failure = null;
  },
  reset(): void {
    liveRules = [];
    updates = [];
    failure = null;
    install();
  },
};

function install(): void {
  const dnr = browser.declarativeNetRequest;

  dnr.getDynamicRules = () =>
    failure === null ? Promise.resolve([...liveRules]) : Promise.reject(failure);

  dnr.updateDynamicRules = (options: UpdateRuleOptions) => {
    if (failure !== null) return Promise.reject(failure);

    updates.push(options);
    const removed = new Set(options.removeRuleIds ?? []);
    liveRules = [...liveRules.filter((rule) => !removed.has(rule.id)), ...(options.addRules ?? [])];
    return Promise.resolve();
  };
}

/**
 * Install the fake on the shared `browser` object and return its handle.
 *
 * Idempotent: the ruleset is process-wide and is cleared by `reset()`, which
 * `tests/setup.ts` runs before every test. Tests that assert on the applied
 * updates call this to obtain the handle.
 */
export function installFakeDynamicRules(): FakeDynamicRules {
  install();
  return handle;
}
