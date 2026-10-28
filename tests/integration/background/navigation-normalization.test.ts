import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createDistractionPredicate } from '@/entrypoints/background';
import { addSiteToList, createAppStore, type AppStore } from '@/store';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';

const T0 = 1_700_000_000_000;

/**
 * A running session whose blocklist was populated through the *entry* path
 * (`addSiteToList`, M2.T4), so the navigation check can be exercised against a
 * state that was built the same way production builds it.
 */
function createRunningStore(blockedSites: ReadonlyArray<string> = []): AppStore {
  const store = createAppStore({
    dependencies: { alarmProvider: new FakeAlarmProvider(T0), now: () => T0 },
  });

  let lists = store.getState().blocklist;
  for (const site of blockedSites) lists = addSiteToList(lists, 'blocklist', site);

  store.setState({
    blocklist: lists,
    timer: {
      status: 'running',
      durationSeconds: 1500,
      remainingSeconds: 1500,
      sessionStartedAt: T0,
      endsAt: T0 + 1_500_000,
      sessionId: 'session-1',
      focusedMs: 0,
      distractedMs: 0,
      lastAccountedAt: T0,
    },
  });

  return store;
}

describe('navigation-check normalization (M2.T21)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('matches a canonical blocklist entry against a non-canonical navigation URL', () => {
    const predicate = createDistractionPredicate(createRunningStore(['facebook.com']));

    expect(predicate('https://m.facebook.com/foo')).toBe(true);
    expect(predicate('https://www.facebook.com')).toBe(true);
    expect(predicate('http://login.facebook.com/')).toBe(true);
    expect(predicate('facebook.com')).toBe(true);
  });

  it('resolves the same input to the same canonical form at entry and at the navigation check', () => {
    const store = createRunningStore(['https://m.facebook.com/entered']);
    const predicate = createDistractionPredicate(store);

    // The entry path stored the canonical form…
    expect(store.getState().blocklist.blocklist[0]?.domain.value).toBe('facebook.com');
    // …and a different URL of the same registrable domain still matches.
    expect(predicate('https://www.facebook.com/navigated')).toBe(true);
    // Both points agree with the shared normalizer.
    expect(normalizeEntry('https://m.facebook.com/entered')).toEqual({
      ok: true,
      value: 'facebook.com',
    });
    expect(normalizeEntry('https://www.facebook.com/navigated')).toEqual({
      ok: true,
      value: 'facebook.com',
    });
  });

  it('does not block when the navigation URL cannot be normalized', () => {
    const predicate = createDistractionPredicate(createRunningStore(['facebook.com']));

    for (const url of ['not a url', '', '   ', 'https://192.168.1.1']) {
      expect(() => predicate(url)).not.toThrow();
      expect(predicate(url)).toBe(false);
    }
  });

  it('does not block a bare public suffix (including private ones)', () => {
    const predicate = createDistractionPredicate(createRunningStore(['facebook.com']));

    for (const url of ['co.uk', 'com', 'github.io']) {
      expect(predicate(url)).toBe(false);
    }
  });

  it('ignores an undefined URL and any non-blocklisted domain', () => {
    const predicate = createDistractionPredicate(createRunningStore(['facebook.com']));

    expect(predicate(undefined)).toBe(false);
    expect(predicate('https://example.com')).toBe(false);
  });

  it('never blocks while the timer is not running', () => {
    const store = createRunningStore(['facebook.com']);
    store.setState({ timer: { ...store.getState().timer, status: 'paused' } });

    expect(createDistractionPredicate(store)('https://m.facebook.com')).toBe(false);
  });

  it('no longer lets a residual allowlist field override the blocklist (CR1.T4)', () => {
    const store = createRunningStore(['facebook.com']);
    // The store may still carry the obsolete field until CR1.T5; enforcement
    // must ignore it instead of restoring the old "allowlist wins" rule.
    store.setState({
      blocklist: {
        allowlist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        blocklist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
        customTags: [],
      },
    });

    expect(createDistractionPredicate(store)('https://m.facebook.com')).toBe(true);
  });
});
