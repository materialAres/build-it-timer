import { describe, it, expect } from 'vitest';
import { createTabDistractionTracker } from '@/lib/timer/tab-distraction-tracker';
import { FakeTabEventSource } from '@/tests/helpers/fake-tab-event-source';

describe('tab distraction tracker (M2.T10)', () => {
  const createHarness = (
    blocked: ReadonlyArray<string>,
    initialTabs: ReadonlyArray<{ id: number; url: string }> = [],
  ) => {
    const eventSource = new FakeTabEventSource();
    eventSource.setInitialTabs(initialTabs);
    let nowMs = 0;
    const tracker = createTabDistractionTracker({
      eventSource,
      isDistractedUrl: (url) => url !== undefined && blocked.some((b) => url.includes(b)),
      now: () => nowMs,
    });
    return {
      eventSource,
      tracker,
      advanceBy: (ms: number) => {
        nowMs += ms;
      },
    };
  };

  it('accumulates no ticks while no blocked tab is open', async () => {
    const { tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    advanceBy(10_000);

    expect(tracker.getTicks()).toBe(0);
  });

  it('accrues one tick per 2s while a blocked tab stays open', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    eventSource.emitUpdated({ id: 1, url: 'https://facebook.com/feed' });
    advanceBy(2_000);
    expect(tracker.getTicks()).toBe(1);

    advanceBy(2_000);
    expect(tracker.getTicks()).toBe(2);

    advanceBy(1_000);
    expect(tracker.getTicks()).toBe(2);
  });

  it('stops accruing once the blocked tab is closed', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    eventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    advanceBy(4_000);
    eventSource.emitRemoved(1);
    advanceBy(10_000);

    expect(tracker.getTicks()).toBe(2);
  });

  it('stops accruing when the tab navigates away from the blocked site', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    eventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    advanceBy(2_000);
    eventSource.emitUpdated({ id: 1, url: 'https://example.com/' });
    advanceBy(10_000);

    expect(tracker.getTicks()).toBe(1);
  });

  it('accumulates across every simultaneously open blocked tab', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    eventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    eventSource.emitUpdated({ id: 2, url: 'https://m.facebook.com/' });
    advanceBy(2_000);

    expect(tracker.getTicks()).toBe(2);
  });

  it('counts blocked tabs already open at startup', async () => {
    const { tracker, advanceBy } = createHarness(['facebook.com'], [
      { id: 1, url: 'https://facebook.com/' },
      { id: 2, url: 'https://example.com/' },
    ]);
    await tracker.ready;

    advanceBy(2_000);

    expect(tracker.getTicks()).toBe(1);
  });

  it('counts a tab only when the supplied predicate says it is distracted', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    // The predicate owns the M2.T6/M2.T8 precedence (allowlist wins); the
    // tracker must not second-guess it.
    eventSource.emitUpdated({ id: 1, url: 'https://example.com/' });
    advanceBy(5_000);

    expect(tracker.getTicks()).toBe(0);
  });

  it('stops observing tab events after dispose', async () => {
    const { eventSource, tracker, advanceBy } = createHarness(['facebook.com']);
    await tracker.ready;

    tracker.dispose();
    eventSource.emitUpdated({ id: 1, url: 'https://facebook.com/' });
    advanceBy(4_000);

    expect(tracker.getTicks()).toBe(0);
  });
});
