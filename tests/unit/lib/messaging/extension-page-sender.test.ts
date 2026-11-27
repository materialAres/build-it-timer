import { describe, expect, it } from 'vitest';
import type { Browser } from 'wxt/browser';
import { isExtensionPageSender } from '@/lib/messaging/extension-page-sender';

type Sender = Browser.runtime.MessageSender;

const ORIGIN = 'chrome-extension://test-extension-id/';
const POPUP = 'chrome-extension://test-extension-id/popup.html';

describe('isExtensionPageSender (PR10.T5)', () => {
  it('accepts an extension page without a tab', () => {
    expect(isExtensionPageSender({ url: POPUP }, ORIGIN)).toBe(true);
  });

  it('accepts an extension page shown in a tab', () => {
    const sender: Sender = { url: POPUP, tab: { id: 1 } as Browser.tabs.Tab };
    expect(isExtensionPageSender(sender, ORIGIN)).toBe(true);
  });

  it('rejects a content-script sender', () => {
    const sender: Sender = {
      url: 'https://evil.com/',
      tab: { id: 1, url: 'https://evil.com/' } as Browser.tabs.Tab,
    };
    expect(isExtensionPageSender(sender, ORIGIN)).toBe(false);
  });

  it('rejects a sender without a url', () => {
    expect(isExtensionPageSender({}, ORIGIN)).toBe(false);
  });

  it('rejects another extension', () => {
    const sender: Sender = { url: 'chrome-extension://other-id/popup.html' };
    expect(isExtensionPageSender(sender, ORIGIN)).toBe(false);
  });

  it('rejects a look-alike prefix', () => {
    const sender: Sender = { url: 'chrome-extension://test-extension-id.evil/popup.html' };
    expect(isExtensionPageSender(sender, ORIGIN)).toBe(false);
  });

  it('rejects an empty origin, even for a popup url', () => {
    expect(isExtensionPageSender({ url: POPUP }, '')).toBe(false);
  });

  it('rejects an origin without a trailing slash', () => {
    expect(isExtensionPageSender({ url: POPUP }, 'chrome-extension://test-extension-id')).toBe(
      false,
    );
  });
});
