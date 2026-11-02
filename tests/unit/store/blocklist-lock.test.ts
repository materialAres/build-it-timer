import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  isBlocklistEditable,
  selectBlocklistEditable,
  type AppStore,
  type BlocklistState,
} from '@/store';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { TimerStatus } from '@/store/store.types';

const focus = { id: 'focus', label: 'Focus' };

const empty: BlocklistState = { blocklist: [], customTags: [] };

const site = (value: string, tagIds: string[] = []) => ({
  domain: { value },
  tagIds,
});

const withSite: BlocklistState = {
  blocklist: [site('x.com')],
  customTags: [],
};

const withTaggedSite: BlocklistState = {
  blocklist: [site('x.com', ['focus'])],
  customTags: [focus],
};

const LOCKED_STATUSES: ReadonlyArray<TimerStatus> = ['running', 'paused', 'completed'];

/** A store at `status` with the given blocklist already seeded. */
function createStoreAt(
  status: TimerStatus,
  seed: BlocklistState,
  sendMutation = vi.fn<(message: MutationMessage) => void>(),
): { store: AppStore; sendMutation: typeof sendMutation } {
  const store = createAppStore({
    dependencies: { sendMutation, now: () => 1_000, random: () => 0.5 },
  });
  store.setState({
    blocklist: seed,
    timer: { ...store.getState().timer, status },
  });
  return { store, sendMutation };
}

/**
 * Run `act` while the store is locked and assert the three properties the lock
 * guarantees: no state change (same reference), no subscriber notification and
 * no mutation sent to the background.
 */
function expectLocked(
  status: TimerStatus,
  seed: BlocklistState,
  act: (store: AppStore) => void,
): void {
  const { store, sendMutation } = createStoreAt(status, seed);
  const before = store.getState().blocklist;
  const notify = vi.fn();
  store.subscribe(notify);

  act(store);

  expect(store.getState().blocklist).toBe(before);
  expect(notify).not.toHaveBeenCalled();
  expect(sendMutation).not.toHaveBeenCalled();
}

describe('isBlocklistEditable (CR2.T1)', () => {
  it('allows editing only while the timer is idle', () => {
    expect(isBlocklistEditable('idle')).toBe(true);
    expect(isBlocklistEditable('running')).toBe(false);
    expect(isBlocklistEditable('paused')).toBe(false);
    expect(isBlocklistEditable('completed')).toBe(false);
  });

  it('reads the decision through the selector', () => {
    const { store } = createStoreAt('idle', empty);
    expect(selectBlocklistEditable(store.getState())).toBe(true);

    store.setState({ timer: { ...store.getState().timer, status: 'running' } });
    expect(selectBlocklistEditable(store.getState())).toBe(false);
  });
});

describe.each(LOCKED_STATUSES)('blocklist lock while %s', (status) => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('ignores addSite', () => {
    expectLocked(status, empty, (store) => {
      store.getState().addSite('facebook.com');
    });
  });

  it('ignores removeSite', () => {
    expectLocked(status, withSite, (store) => {
      store.getState().removeSite('x.com');
    });
  });

  it('ignores applyPreset', () => {
    expectLocked(status, empty, (store) => {
      store.getState().applyPreset('social');
    });
  });

  it('ignores createTag', () => {
    expectLocked(status, empty, (store) => {
      store.getState().createTag('Focus');
    });
  });

  it('ignores deleteTag', () => {
    expectLocked(status, withTaggedSite, (store) => {
      store.getState().deleteTag('focus');
    });
  });

  it('ignores assignTag', () => {
    expectLocked(status, withSite, (store) => {
      store.getState().assignTag('x.com', 'focus');
    });
  });

  it('ignores unassignTag', () => {
    expectLocked(status, withTaggedSite, (store) => {
      store.getState().unassignTag('x.com', 'focus');
    });
  });
});

describe('blocklist editing while idle', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('addSite applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', empty);

    store.getState().addSite('facebook.com');

    expect(store.getState().blocklist.blocklist.map((entry) => entry.domain.value)).toEqual([
      'facebook.com',
    ]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('removeSite applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSite);

    store.getState().removeSite('x.com');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('applyPreset expands the whole preset with one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', empty);

    store.getState().applyPreset('social');

    expect(store.getState().blocklist.blocklist).toHaveLength(4);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('createTag applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', empty);

    store.getState().createTag('Focus');

    expect(store.getState().blocklist.customTags).toHaveLength(1);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('deleteTag applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withTaggedSite);

    store.getState().deleteTag('focus');

    expect(store.getState().blocklist.customTags).toEqual([]);
    expect(store.getState().blocklist.blocklist[0]?.tagIds).toEqual([]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('assignTag applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSite);

    store.getState().assignTag('x.com', 'focus');

    expect(store.getState().blocklist.blocklist[0]?.tagIds).toEqual(['focus']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('unassignTag applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withTaggedSite);

    store.getState().unassignTag('x.com', 'focus');

    expect(store.getState().blocklist.blocklist[0]?.tagIds).toEqual([]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });
});
