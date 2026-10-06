import type { TabEventSource, TrackedTab } from '@/lib/timer/tab-distraction-tracker';

/**
 * Deterministic `TabEventSource` (principle L): tests push tab events and seed
 * the initially open tabs without touching `browser.tabs`.
 */
export class FakeTabEventSource implements TabEventSource {
  private readonly updatedListeners = new Set<(tab: TrackedTab) => void>();
  private readonly removedListeners = new Set<(tabId: number) => void>();
  private initialTabs: ReadonlyArray<TrackedTab> = [];

  setInitialTabs(tabs: ReadonlyArray<TrackedTab>): void {
    this.initialTabs = tabs;
  }

  queryTabs(): Promise<ReadonlyArray<TrackedTab>> {
    return Promise.resolve(this.initialTabs);
  }

  onUpdated(listener: (tab: TrackedTab) => void): () => void {
    this.updatedListeners.add(listener);
    return () => {
      this.updatedListeners.delete(listener);
    };
  }

  onRemoved(listener: (tabId: number) => void): () => void {
    this.removedListeners.add(listener);
    return () => {
      this.removedListeners.delete(listener);
    };
  }

  emitUpdated(tab: TrackedTab): void {
    for (const listener of [...this.updatedListeners]) listener(tab);
  }

  emitRemoved(tabId: number): void {
    for (const listener of [...this.removedListeners]) listener(tabId);
  }
}
