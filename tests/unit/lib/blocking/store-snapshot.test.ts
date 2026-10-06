import { describe, it, expect } from 'vitest';
import { parseStoreSnapshot, STORE_STORAGE_KEY } from '@/lib/blocking/store-snapshot';

const envelope = (state: unknown): string => JSON.stringify({ state, version: 1 });

const blocklistState = {
  allowlist: [],
  blocklist: [{ domain: { value: 'facebook.com' }, tagIds: [] }],
  customTags: [],
};

describe('parseStoreSnapshot (M2.T8)', () => {
  it('uses the same storage key as the store', () => {
    expect(STORE_STORAGE_KEY).toBe('timer-focus-store');
  });

  it('extracts the timer status and the two lists from the persisted envelope', () => {
    const result = parseStoreSnapshot(
      envelope({
        timer: { status: 'running', remainingSeconds: 60, sessionStartedAt: 0, sessionId: 's1' },
        blocklist: blocklistState,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.timerStatus).toBe('running');
    expect(result.value.blocklist).toEqual(blocklistState.blocklist);
    expect(result.value.allowlist).toEqual([]);
  });

  it('ignores the slices it does not need', () => {
    const result = parseStoreSnapshot(
      envelope({
        timer: { status: 'idle', remainingSeconds: 1, sessionStartedAt: null, sessionId: null },
        blocklist: blocklistState,
        city: { themeId: 'whatever' },
        score: { level: 'bad' },
      }),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects a missing or empty value', () => {
    expect(parseStoreSnapshot(undefined).ok).toBe(false);
    expect(parseStoreSnapshot(null).ok).toBe(false);
    expect(parseStoreSnapshot('').ok).toBe(false);
    expect(parseStoreSnapshot(42).ok).toBe(false);
  });

  it('rejects malformed JSON without throwing', () => {
    expect(parseStoreSnapshot('{not json').ok).toBe(false);
  });

  it('rejects a payload without the state envelope', () => {
    expect(parseStoreSnapshot(JSON.stringify({ version: 1 })).ok).toBe(false);
    expect(parseStoreSnapshot(JSON.stringify('a string')).ok).toBe(false);
  });

  it('rejects a malformed blocklist', () => {
    const withBadEntry = envelope({
      timer: { status: 'running' },
      blocklist: { allowlist: [], blocklist: [{ domain: {} }], customTags: [] },
    });

    expect(parseStoreSnapshot(withBadEntry).ok).toBe(false);
    expect(
      parseStoreSnapshot(
        envelope({ timer: { status: 'running' }, blocklist: { allowlist: 'nope' } }),
      ).ok,
    ).toBe(false);
  });

  it('rejects a missing or unknown timer status', () => {
    expect(parseStoreSnapshot(envelope({ blocklist: blocklistState })).ok).toBe(false);
    expect(
      parseStoreSnapshot(
        envelope({ timer: { status: 'exploded' }, blocklist: blocklistState }),
      ).ok,
    ).toBe(false);
  });
});
