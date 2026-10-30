import { describe, it, expect } from 'vitest';
import { parseStoreSnapshot, STORE_STORAGE_KEY } from '@/lib/blocking/store-snapshot';

const envelope = (state: unknown, version = 2): string =>
  JSON.stringify({ state, version });

const entry = (value: string) => ({ domain: { value }, tagIds: [] });

const runningTimer = { status: 'running', remainingSeconds: 60, sessionStartedAt: 0, sessionId: 's1' };

/** The current (version-2) single-list shape. */
const currentBlocklistState = {
  blocklist: [entry('facebook.com')],
  customTags: [],
};

/** The legacy (version-1) two-list shape. */
const legacyBlocklistState = {
  allowlist: [entry('facebook.com')],
  blocklist: [entry('facebook.com'), entry('instagram.com')],
  customTags: [],
};

describe('parseStoreSnapshot (M2.T8, CR1.T4)', () => {
  it('uses the same storage key as the store', () => {
    expect(STORE_STORAGE_KEY).toBe('timer-focus-store');
  });

  it('extracts the timer status and the blocklist from the current envelope', () => {
    const result = parseStoreSnapshot(
      envelope({ timer: runningTimer, blocklist: currentBlocklistState }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.timerStatus).toBe('running');
    expect(result.value.blocklist).toEqual(currentBlocklistState.blocklist);
  });

  it('accepts a legacy envelope and returns the effective blocklist', () => {
    const result = parseStoreSnapshot(
      envelope({ timer: runningTimer, blocklist: legacyBlocklistState }, 1),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // `facebook.com` was on both lists: the old "allowlist wins" result keeps
    // it unblocked, so it must not survive the migration.
    expect(result.value.blocklist.map((item) => item.domain.value)).toEqual(['instagram.com']);
  });

  it('drops a domain present only in the legacy allowlist', () => {
    const result = parseStoreSnapshot(
      envelope(
        {
          timer: runningTimer,
          blocklist: {
            allowlist: [entry('keep.com')],
            blocklist: [],
            customTags: [],
          },
        },
        1,
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blocklist).toEqual([]);
  });

  it('accepts the completed timer status (M3.T3c)', () => {
    const result = parseStoreSnapshot(
      envelope({
        timer: { ...runningTimer, status: 'completed' },
        blocklist: currentBlocklistState,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.timerStatus).toBe('completed');
  });

  it('ignores the slices it does not need', () => {
    const result = parseStoreSnapshot(
      envelope({
        timer: { status: 'idle', remainingSeconds: 1, sessionStartedAt: null, sessionId: null },
        blocklist: currentBlocklistState,
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
    expect(parseStoreSnapshot(JSON.stringify({ version: 2 })).ok).toBe(false);
    expect(parseStoreSnapshot(JSON.stringify('a string')).ok).toBe(false);
  });

  it('rejects a malformed blocklist', () => {
    expect(
      parseStoreSnapshot(
        envelope({ timer: { status: 'running' }, blocklist: { blocklist: [{ domain: {} }] } }),
      ).ok,
    ).toBe(false);
    expect(
      parseStoreSnapshot(
        envelope({ timer: { status: 'running' }, blocklist: { blocklist: 'nope' } }),
      ).ok,
    ).toBe(false);
    expect(
      parseStoreSnapshot(envelope({ timer: { status: 'running' }, blocklist: {} })).ok,
    ).toBe(false);
  });

  it('tolerates a malformed legacy second list, keeping the valid blocklist', () => {
    const result = parseStoreSnapshot(
      envelope(
        {
          timer: { status: 'running' },
          blocklist: { allowlist: 'nope', blocklist: [entry('facebook.com')], customTags: [] },
        },
        1,
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blocklist).toEqual([entry('facebook.com')]);
  });

  it('does not need the allowlist field at all', () => {
    // A version-2 payload has no `allowlist` key; it must parse unchanged.
    expect(currentBlocklistState).not.toHaveProperty('allowlist');

    expect(
      parseStoreSnapshot(envelope({ timer: runningTimer, blocklist: currentBlocklistState })).ok,
    ).toBe(true);
  });

  it('rejects a missing or unknown timer status', () => {
    expect(parseStoreSnapshot(envelope({ blocklist: currentBlocklistState })).ok).toBe(false);
    expect(
      parseStoreSnapshot(
        envelope({ timer: { status: 'exploded' }, blocklist: currentBlocklistState }),
      ).ok,
    ).toBe(false);
  });
});
