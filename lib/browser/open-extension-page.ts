import { browser } from 'wxt/browser';
import { err, ok, type Result } from '@/utils/result';

/** The two browser calls opening a page needs, injectable so tests need no browser (principle D). */
export interface ExtensionPageApi {
  readonly getUrl: (path: string) => string;
  readonly createTab: (url: string) => Promise<unknown>;
}

const browserApi: ExtensionPageApi = {
  // WXT types `getURL` to the paths it built; the caller passes one of its own pages.
  getUrl: (path) => browser.runtime.getURL(path as Parameters<typeof browser.runtime.getURL>[0]),
  createTab: (url) => browser.tabs.create({ url }),
};

/**
 * Open one of the extension's own pages (for example `/city.html`) in a new
 * tab. A boundary (§1.4): a missing window or a bad path is an error result,
 * never an exception into the popup.
 */
export async function openExtensionPage(
  path: string,
  api: ExtensionPageApi = browserApi,
): Promise<Result<void>> {
  try {
    await api.createTab(api.getUrl(path));
    return ok(undefined);
  } catch (cause) {
    return err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}
