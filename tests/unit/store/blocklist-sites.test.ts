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

    store.getState().addSite('blocklist', 'https://m.facebook.com/something');

    expect(domainValues(store.getState().blocklist.blocklist)).toEqual(['facebook.com']);
    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(sendMutation).toHaveBeenCalledWith({
      type: 'BLOCKLIST_ADD_SITE',
      payload: { list: 'blocklist', site: 'https://m.facebook.com/something' },
    });
  });

  it('addSite to an already-present domain is a silent no-op', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.getState().addSite('blocklist', 'facebook.com');

    store.getState().addSite('blocklist', 'facebook.com');

    expect(store.getState().blocklist.blocklist).toHaveLength(1);
    expect(sendMutation).toHaveBeenCalledTimes(1);
  });

  it('addSite to the opposite list moves the domain (no double entry)', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().addSite('blocklist', 'x.com');
    store.getState().addSite('allowlist', 'x.com');

    expect(domainValues(store.getState().blocklist.blocklist)).toEqual([]);
    expect(domainValues(store.getState().blocklist.allowlist)).toEqual(['x.com']);
    expect(sendMutation).toHaveBeenCalledTimes(2);
  });

  it('addSite rejects an invalid domain without sending a mutation', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().addSite('blocklist', 'co.uk');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).not.toHaveBeenCalled();
  });

  it('removeSite removes the entry and sends BLOCKLIST_REMOVE_SITE', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);
    store.getState().addSite('blocklist', 'facebook.com');

    store.getState().removeSite('blocklist', 'facebook.com');

    expect(store.getState().blocklist.blocklist).toEqual([]);
    expect(sendMutation).toHaveBeenLastCalledWith({
      type: 'BLOCKLIST_REMOVE_SITE',
      payload: { list: 'blocklist', site: 'facebook.com' },
    });
  });

  it('removeSite on an absent domain sends nothing', () => {
    const sendMutation = vi.fn<(message: MutationMessage) => void>();
    const store = createStore(sendMutation);

    store.getState().removeSite('blocklist', 'facebook.com');

    expect(sendMutation).not.toHaveBeenCalled();
  });
});
