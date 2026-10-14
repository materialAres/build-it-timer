import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { defineConfig } from 'wxt';

/**
 * `wxt dev` opens a Chromium-based browser through `web-ext` -> `chrome-launcher`,
 * which needs a Chrome/Chromium executable on the machine. Rather than
 * depending on a system Chrome install, reuse the Chromium bundled with
 * Playwright (already installed for the e2e tests, see M0.T4). An explicit
 * `CHROME_PATH` always takes precedence, so developers with their own Chrome
 * can override this.
 */
function resolveChromeBinary(): string | undefined {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }
  try {
    const bundled = chromium.executablePath();
    return existsSync(bundled) ? bundled : undefined;
  } catch {
    // Playwright browsers are not installed: let `web-ext` auto-detect Chrome.
    return undefined;
  }
}

const chromeBinary = resolveChromeBinary();

// See https://wxt.dev/api/config.html
export default defineConfig({
  // `@wxt-dev/i18n/module` (M3.T9) wires the type-safe, synchronous wrapper
  // around `browser.i18n`, compiles `locales/<lang>.yml` into the
  // `_locales/<lang>/messages.json` the browser expects, and auto-imports the
  // shared `i18n` instance from `#i18n`. Registration requires
  // `manifest.default_locale` (set below), otherwise the module disables itself.
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  // Firefox defaults to MV2 in WXT, but `declarativeNetRequest` — the engine
  // behind in-session blocking (M2.T6/M2.T7) — only exists in MV3 on Firefox.
  // Forcing MV3 on every target keeps the manifest, DNR, `browser.alarms` and
  // the Shadow-DOM overlay behaving identically on both build targets. WXT
  // emits a `background.scripts` event page for Firefox MV3, which is what
  // Firefox requires (it has no service-worker background).
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // English is the default language and the fallback for every missing key
    // (M3.T9): `@wxt-dev/i18n` reads the browser's own language and serves the
    // matching `_locales/<lang>/messages.json`, so there is no language selector
    // nor a persisted preference.
    default_locale: 'en',
    // WXT does not infer permissions from the APIs a module imports, so they
    // must be declared explicitly. Without `storage` the popup's
    // `attachStoreSync` throws (`browser.storage` is undefined) before React
    // renders, leaving the popup blank; without `alarms` the background's
    // `createBrowserAlarmProvider` fails the same way. `declarativeNetRequest`
    // is what the background's rule sync (M2.T7) needs to install the
    // blocklist rules. `tabs` (M2.T10) makes the tab's URL available to the
    // distraction tracker regardless of host-permission timing: the tracker
    // reads the URL from `tabs.onUpdated`/`tabs.query`, and host permissions
    // alone can leave it undefined on a restricted page.
    permissions: ['storage', 'alarms', 'declarativeNetRequest', 'tabs'],
    // The overlay (M2.T8) must be able to run on any page, because the
    // blocklist is user-defined and therefore unknown at build time. Declared
    // both as a host permission (so the script may be injected) and as a
    // content script match (see `entrypoints/blocked-overlay.content.ts`).
    host_permissions: ['<all_urls>'],
    // An empty but enabled static ruleset (the file is copied from `public/`).
    // Firefox ≤ 132 can silently drop dynamic DNR rules after a browser
    // restart unless at least one static ruleset is declared (Mozilla bug
    // 1921353), so this keeps the in-session blocklist alive across restarts
    // on Firefox as well as Chrome.
    declarative_net_request: {
      rule_resources: [
        { id: 'empty', enabled: true, path: 'rules/empty-rule-set.json' },
      ],
    },
    ...(browser === 'firefox'
      ? {
          // Firefox requires an explicit add-on id for MV3 (WXT warns without
          // one). Dynamic DNR rules need Firefox 113+, and the extension
          // collects no data, which must be declared for AMO.
          browser_specific_settings: {
            gecko: {
              id: 'buildit-timer-focus@example.com',
              strict_min_version: '113.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
  webExt: {
    // `binaries` is keyed by browser name; an empty map keeps web-ext's own
    // auto-detection as the fallback.
    binaries: chromeBinary ? { chrome: chromeBinary } : {},
  },
});
