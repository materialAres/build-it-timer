import type { Browser } from 'wxt/browser';

/**
 * Tells whether a message comes from one of the extension's own pages (popup,
 * offscreen document) and not from a tab. Content scripts share a renderer
 * process with the page they run in, so the `sender.id` check alone does not
 * exclude them: they have the right id plus a `tab`.
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
  if (sender.tab !== undefined) return false;
  return typeof sender.url === 'string' && sender.url.startsWith(extensionOrigin);
}
