import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createAppStore,
  isBlocklistAddAllowed,
  isBlocklistEditable,
  selectBlocklistAddAllowed,
  selectBlocklistEditable,
  type AppStore,
  type BlocklistState,
} from '@/store';
import type { MutationMessage } from '@/lib/messaging/messages.types';
import type { TimerStatus } from '@/store/store.types';

const empty: BlocklistState = {
  blocklist: [],
  appliedPresetIds: [],
  userPresets: [],
};

const site = (value: string, presetIds: string[] = []) => ({
  domain: { value },
  manual: presetIds.length === 0,
  presetIds,
});

const withSite: BlocklistState = { ...empty, blocklist: [site('x.com')] };

const withSavedPreset: BlocklistState = {
  blocklist: [site('x.com', ['user:focus'])],
  appliedPresetIds: ['user:focus'],
  userPresets: [
    { id: 'user:focus', name: 'Focus', domains: [{ value: 'x.com' }] },
  ],
};

const LOCKED_STATUSES: ReadonlyArray<TimerStatus> = [
  'running',
  'paused',
  'completed',
];

/** Statuses where CR5 lets the list grow but never shrink. */
const ADD_ONLY_STATUSES: ReadonlyArray<TimerStatus> = ['running', 'paused'];

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

describe('isBlocklistAddAllowed (CR5.T1)', () => {
  it('allows adding in idle, running and paused, not once completed', () => {
    expect(isBlocklistAddAllowed('idle')).toBe(true);
    expect(isBlocklistAddAllowed('running')).toBe(true);
    expect(isBlocklistAddAllowed('paused')).toBe(true);
    expect(isBlocklistAddAllowed('completed')).toBe(false);
  });

  it('is never stricter than the idle-only editing rule', () => {
    const statuses: ReadonlyArray<TimerStatus> = [
      'idle',
      'running',
      'paused',
      'completed',
    ];
    for (const status of statuses) {
      if (isBlocklistEditable(status)) {
        expect(isBlocklistAddAllowed(status)).toBe(true);
      }
    }
  });

  it('reads the decision through the selector', () => {
    const { store } = createStoreAt('running', empty);
    expect(selectBlocklistAddAllowed(store.getState())).toBe(true);
    expect(selectBlocklistEditable(store.getState())).toBe(false);

    store.setState({
      timer: { ...store.getState().timer, status: 'completed' },
    });
    expect(selectBlocklistAddAllowed(store.getState())).toBe(false);
  });
});

describe.each(LOCKED_STATUSES)('blocklist lock while %s', (status) => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('ignores removeSite', () => {
    expectLocked(status, withSite, (store) => {
      store.getState().removeSite('x.com');
    });
  });

  it('ignores togglePreset off', () => {
    expectLocked(status, withSavedPreset, (store) => {
      store.getState().togglePreset('user:focus', false);
    });
  });

  it('ignores savePreset', () => {
    expectLocked(status, withSite, (store) => {
      store.getState().savePreset('Focus');
    });
  });

  it('ignores renamePreset', () => {
    expectLocked(status, withSavedPreset, (store) => {
      store.getState().renamePreset('user:focus', 'Deep work');
    });
  });

  it('ignores deletePreset', () => {
    expectLocked(status, withSavedPreset, (store) => {
      store.getState().deletePreset('user:focus');
    });
  });
});

describe.each(ADD_ONLY_STATUSES)(
  'add-direction editing while %s (CR5.T1)',
  (status) => {
    beforeEach(() => {
      fakeBrowser.reset();
    });

    it('addSite applies and sends exactly one mutation', () => {
      const { store, sendMutation } = createStoreAt(status, empty);

      store.getState().addSite('facebook.com');

      expect(
        store.getState().blocklist.blocklist.map((e) => e.domain.value),
      ).toEqual(['facebook.com']);
      expect(sendMutation).toHaveBeenCalledTimes(1);
    });

    it('addSite on a preset-only site marks it manual', () => {
      const { store } = createStoreAt(status, {
        ...withSavedPreset,
      });

      store.getState().addSite('x.com');

      expect(store.getState().blocklist.blocklist[0]?.manual).toBe(true);
    });

    it('togglePreset on applies the whole preset with one mutation', () => {
      const { store, sendMutation } = createStoreAt(status, empty);

      store.getState().togglePreset('social', true);

      expect(store.getState().blocklist.blocklist).toHaveLength(4);
      expect(store.getState().blocklist.appliedPresetIds).toEqual(['social']);
      expect(sendMutation).toHaveBeenCalledTimes(1);
    });
  },
);

describe('add-direction editing once completed (CR5.T1)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('ignores addSite', () => {
    expectLocked('completed', empty, (store) => {
      store.getState().addSite('facebook.com');
    });
  });

  it('ignores togglePreset on', () => {
    expectLocked('completed', empty, (store) => {
      store.getState().togglePreset('social', true);
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

    expect(
      store.getState().blocklist.blocklist.map((entry) => entry.domain.value),
    ).toEqual(['facebook.com']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('removeSite applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSite);

    store.getState().removeSite('x.com');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('togglePreset applies the whole preset with one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', empty);

    store.getState().togglePreset('social', true);

    expect(store.getState().blocklist.blocklist).toHaveLength(4);
    expect(store.getState().blocklist.appliedPresetIds).toEqual(['social']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('savePreset applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSite);

    store.getState().savePreset('Focus');

    expect(store.getState().blocklist.userPresets).toHaveLength(1);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('renamePreset applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSavedPreset);

    store.getState().renamePreset('user:focus', 'Deep work');

    expect(store.getState().blocklist.userPresets[0]?.name).toBe('Deep work');
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('deletePreset applies and sends exactly one mutation', () => {
    const { store, sendMutation } = createStoreAt('idle', withSavedPreset);

    store.getState().deletePreset('user:focus');

    expect(store.getState().blocklist.userPresets).toEqual([]);
    expect(store.getState().blocklist.blocklist).toEqual([site('x.com')]);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });
});
