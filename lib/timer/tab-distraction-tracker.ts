import { browser, type Browser } from 'wxt/browser';
import { MALUS_TICK_MS } from '@/lib/score/apply-malus';

/** A tab as the tracker needs to see it (id + last known URL). */
export interface TrackedTab {
  readonly id: number;
  readonly url: string | undefined;
}

/**
 * The browser side of the tracker: a minimal port over the tab events the
 * multi-tab rule needs. Keeping it an interface lets the tracker be tested
 * deterministically with a fake source and never import `browser.tabs` itself
 * (principle D/L).
 */
export interface TabEventSource {
  /** Currently open tabs, used to seed the set at startup. */
  queryTabs(): Promise<ReadonlyArray<TrackedTab>>;
  onUpdated(listener: (tab: TrackedTab) => void): () => void;
  onRemoved(listener: (tabId: number) => void): () => void;
}

export interface DistractionTrackerDependencies {
  readonly eventSource: TabEventSource;
  /** Whether a URL is a blocked site that must accrue malus (allowlist wins). */
  readonly isDistractedUrl: (url: string | undefined) => boolean;
  /** Clock (injectable for deterministic tests). */
  readonly now: () => number;
  /** Tick length in ms; defaults to the shared 2s malus cadence (M2.T15). */
  readonly tickMs?: number;
}

export interface TabDistractionTracker {
  /** Resolves once the initially open tabs have been read. */
  readonly ready: Promise<void>;
  /** Whole 2s ticks accumulated so far, sampled at `now()`. */
  getTicks(): number;
  /** Stop observing tab events. */
  dispose(): void;
}

/**
 * Track how long a blocked site stays open, across every open tab.
 *
 * Why the **any-open-tab** rule (roadmap M2.T10, first choice): keeping a
 * blocked tab open is itself the distraction, and `tabs.onUpdated`/`onRemoved`
 * with `tabs.query` reliably report a tab's URL and its open/closed transitions
 * without depending on focus. The active-tab fallback would need
 * `tabs.onActivated` + `windows.onFocusChanged` and would under-count the
 * simultaneously open blocked tabs the roadmap asks to accumulate.
 *
 * Each open blocked tab contributes one tick per `tickMs`, so N open blocked
 * tabs accrue N ticks per interval ("accumulating distraction time across all
 * simultaneously open blocked tabs").
 */
export function createTabDistractionTracker(
  dependencies: DistractionTrackerDependencies,
): TabDistractionTracker {
  const tickMs = dependencies.tickMs ?? MALUS_TICK_MS;
  const openBlockedTabs = new Set<number>();
  let accumulatedMs = 0;
  let lastSampleMs = dependencies.now();

  // Convert the elapsed wall-clock time into distraction time, weighted by the
  // number of blocked tabs that were open during it.
  const sample = (): void => {
    const nowMs = dependencies.now();
    const elapsedMs = Math.max(0, nowMs - lastSampleMs);
    accumulatedMs += elapsedMs * openBlockedTabs.size;
    lastSampleMs = nowMs;
  };

  const track = (tab: TrackedTab): void => {
    sample();
    if (dependencies.isDistractedUrl(tab.url)) openBlockedTabs.add(tab.id);
    else openBlockedTabs.delete(tab.id);
  };

  const untrack = (tabId: number): void => {
    sample();
    openBlockedTabs.delete(tabId);
  };

  const disposers = [
    dependencies.eventSource.onUpdated(track),
    dependencies.eventSource.onRemoved(untrack),
  ];

  const ready = dependencies.eventSource.queryTabs().then((tabs) => {
    for (const tab of tabs) {
      if (dependencies.isDistractedUrl(tab.url)) openBlockedTabs.add(tab.id);
    }
    lastSampleMs = dependencies.now();
  });

  return {
    ready,
    getTicks(): number {
      sample();
      return Math.floor(accumulatedMs / tickMs);
    },
    dispose(): void {
      for (const dispose of disposers) dispose();
    },
  };
}

/** Real `TabEventSource` backed by `browser.tabs` (requires `tabs` access). */
export function createBrowserTabEventSource(): TabEventSource {
  return {
    async queryTabs(): Promise<ReadonlyArray<TrackedTab>> {
      const tabs = await browser.tabs.query({});
      return tabs
        .filter((tab): tab is Browser.tabs.Tab & { id: number } => tab.id !== undefined)
        .map((tab) => ({ id: tab.id, url: tab.url }));
    },
    onUpdated(listener): () => void {
      const handler = (
        _tabId: number,
        _changeInfo: Browser.tabs.OnUpdatedInfo,
        tab: Browser.tabs.Tab,
      ): void => {
        if (tab.id === undefined) return;
        listener({ id: tab.id, url: tab.url });
      };
      browser.tabs.onUpdated.addListener(handler);
      return () => {
        browser.tabs.onUpdated.removeListener(handler);
      };
    },
    onRemoved(listener): () => void {
      browser.tabs.onRemoved.addListener(listener);
      return () => {
        browser.tabs.onRemoved.removeListener(listener);
      };
    },
  };
}
