import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore } from '@/store';
import type { MutationMessage } from '@/lib/messaging/messages.types';

describe('site CRUD actions (M3.T3)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createStore = (sendMutation: (message: MutationMessage) => void) =>
    createAppStore({ dependencies: { sendMutation } });

  const domainValues = (list: ReadonlyArray<{ domain: { value: string } }>) =>
    list.map((entry) => entry.domain.value);

  it('addSite adds a normalized entry locally and sends one BLOCKLIST_ADD_SITE', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().addSite('https://m.facebook.com/something');

    expect(domainValues(store.getState().blocklist.blocklist)).toEqual(['facebook.com']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { site: 'https://m.facebook.com/something' },
    });
  });

  it('addSite to an already-present domain is a silent no-op', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.getState().addSite('facebook.com');

    store.getState().addSite('facebook.com');

    expect(store.getState().blocklist.blocklist).toHaveLength(1);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('addSite only ever writes the single blocklist (CR1.T5a)', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().addSite('x.com');

    const state = store.getState().blocklist;
    expect(domainValues(state.blocklist)).toEqual(['x.com']);
    expect(Object.keys(state).sort()).toEqual(['blocklist', 'customTags']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('addSite rejects an invalid domain without sending a mutation', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().addSite('co.uk');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('removeSite removes the entry and sends BLOCKLIST_REMOVE_SITE', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.getState().addSite('facebook.com');

    store.getState().removeSite('facebook.com');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).toHaveBeenLastCalledWith({
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { site: 'facebook.com' },
    });
  });

  it('removeSite on an absent domain sends nothing', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().removeSite('facebook.com');

    expect(sendMutation).not.toHaveBeenCalled();
  });
});
