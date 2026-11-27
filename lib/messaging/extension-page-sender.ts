import type { Browser } from 'wxt/browser';

/**
 * Tells whether a message comes from one of the extension's own pages (popup,
 * offscreen document) and not from a content script. Content scripts share a
 * renderer process with the page they run in, so the `sender.id` check alone
 * does not exclude them. Their `sender.url` is the web page's, never an
 * extension URL, so the URL prefix is what tells them apart. `sender.tab` is
 * not checked: an extension page shown in a tab (the e2e tests open the popup
 * that way) is still extension code.
 *
 * `extensionOrigin` is the URL `browser.runtime.getURL('/')` returns. It is a
 * parameter so this module never touches `browser.*`. It must be non-empty and
 * end with `/`: an empty prefix matches every URL, and a prefix without the
 * slash also matches look-alikes such as `chrome-extension://<id>.evil/`.
 */
export function isExtensionPageSender(
  sender: Browser.runtime.MessageSender,
  extensionOrigin: string,
): boolean {
  if (extensionOrigin === '' || !extensionOrigin.endsWith('/')) return false;
  return typeof sender.url === 'string' && sender.url.startsWith(extensionOrigin);
}
