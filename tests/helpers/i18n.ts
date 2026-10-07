import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { browser } from 'wxt/browser';
import { generateChromeMessages, parseMessagesText } from '@wxt-dev/i18n/build';

/**
 * Test-only stand-in for the browser's native i18n backend (M3.T9).
 *
 * In production `@wxt-dev/i18n`'s shared `i18n` instance delegates to
 * `browser.i18n.getMessage`, which the browser resolves against the compiled
 * `_locales/<lang>/messages.json`. `fakeBrowser` (wxt/testing) does not
 * implement `i18n.getMessage`, so component tests would otherwise log
 * `Message not found` and render empty strings.
 *
 * This helper parses the *real* `locales/<lang>.yml` sources (the same files the
 * build compiles) and installs a `getMessage` that reproduces the browser's
 * lookup — including `$1`..`$9` substitution and `$$` escaping. That keeps the
 * tests honest: a component renders a string only if the key actually exists in
 * the locale file, so a missing/renamed key fails the suite instead of silently
 * passing. Locale selection mirrors the API: `setTestLocale('it')` simulates a
 * browser set to Italian (M3.T10); the default is the EN fallback.
 */

type Dictionary = ReadonlyMap<string, string>;

const LOCALES_DIR = resolve(import.meta.dirname, '../../locales');

function loadDictionary(locale: string): Dictionary {
  const file = resolve(LOCALES_DIR, `${locale}.yml`);
  if (!existsSync(file)) return new Map();

  const messages = generateChromeMessages(
    parseMessagesText(readFileSync(file, 'utf8'), 'YAML'),
  );
  return new Map(
    Object.entries(messages).map(([key, value]) => [key, value.message]),
  );
}

const dictionaries: ReadonlyMap<string, Dictionary> = new Map([
  ['en', loadDictionary('en')],
  ['it', loadDictionary('it')],
]);

let activeLocale = 'en';

/** Positional substitution, mirroring `browser.i18n`'s `$1`..`$9` handling. */
function applySubstitutions(
  message: string,
  substitutions?: string | string[],
): string {
  const values =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions];

  return message
    .replace(
      /\$(\d)/g,
      (match, index: string) => values[Number(index) - 1] ?? match,
    )
    .replace(/\$\$/g, '$');
}

/** Install the `getMessage` backend; called once from `tests/setup.ts`. */
export function installI18nBackend(): void {
  browser.i18n.getMessage = (
    key: string,
    substitutions?: string | string[],
  ): string => {
    // Mirror the browser's `default_locale` fallback: a key missing from the
    // active language resolves against the EN default instead of rendering
    // empty (M3.T10 relies on this while a new locale is incomplete).
    const message =
      dictionaries.get(activeLocale)?.get(key) ??
      dictionaries.get('en')?.get(key);
    if (message === undefined) return '';
    return applySubstitutions(message, substitutions);
  };
}

/**
 * Force the language the mocked backend serves. The real API infers it from the
 * browser's UI language, which a test cannot change, so this is the seam used to
 * prove a component follows the active locale (M3.T10).
 */
export function setTestLocale(locale: string): void {
  activeLocale = locale;
}

/** Reset to the default EN locale; called from `beforeEach` for isolation. */
export function resetTestLocale(): void {
  activeLocale = 'en';
}
