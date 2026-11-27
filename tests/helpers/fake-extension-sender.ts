import { fakeBrowser } from 'wxt/testing/fake-browser';

/**
 * Delivers `message` to the bus listeners as `sender` would. The bus only
 * accepts a message whose `sender.id` is this extension's (M6.T1), and
 * `fakeBrowser.runtime.sendMessage` hands listeners no `sender` at all, so the
 * tests use this to choose the sender explicitly (a foreign id, a tab, none).
 */
export async function deliverAs(message: unknown, sender: unknown): Promise<void> {
  // The replies of the listeners are not used; the bus listeners return void.
  await fakeBrowser.runtime.onMessage
    .trigger(message, sender as never, () => undefined)
    .then(() => undefined);
}

/** Delivers `message` as a content script in a tab showing `url` would. */
export function sendFromTab(message: unknown, url: string): Promise<void> {
  return deliverAs(message, {
    id: fakeBrowser.runtime.id,
    tab: { id: 1, url },
  });
}

/**
 * Replaces `fakeBrowser.runtime.sendMessage` so every test message arrives as
 * the extension's popup would deliver it (this extension's id, no tab, a
 * `popup.html` url), and still rejects when nobody listens, like the real call.
 * The background accepts mutations only from such a sender (PR10.T5b).
 */
export function installExtensionSender(): void {
  fakeBrowser.runtime.sendMessage = (message: unknown): Promise<undefined> => {
    if (!fakeBrowser.runtime.onMessage.hasListeners()) {
      return Promise.reject(
        new Error('Could not establish connection. Receiving end does not exist.'),
      );
    }
    return deliverAs(message, {
      id: fakeBrowser.runtime.id,
      url: fakeBrowser.runtime.getURL('/popup.html'),
    }).then(() => undefined);
  };
}
