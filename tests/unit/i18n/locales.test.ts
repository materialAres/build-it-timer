import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMessagesText } from '@wxt-dev/i18n/build';
import { useAppStore } from '@/store';

const LOCALES_DIR = resolve(import.meta.dirname, '../../../locales');

/**
 * The key paths declared by a `locales/<lang>.yml` source, using the same parser
 * the build and the test i18n backend use (M3.T9), so the comparison is against
 * the real files. The standard `@@` chrome keys are appended by the parser and
 * are identical for every locale, so they are filtered out to keep the
 * comparison about the project's own tree.
 */
function keyPaths(locale: string): string[] {
  const text = readFileSync(resolve(LOCALES_DIR, `${locale}.yml`), 'utf8');
  return parseMessagesText(text, 'YAML')
    .map((message) => message.key.join('.'))
    .filter((key) => !key.startsWith('@@'));
}

/**
 * M3.T10 — the Italian translation must mirror the English tree key-for-key, and
 * the language must be resolved automatically from the browser with no selector
 * or persisted preference. This is the drift-detection guard: a key added to
 * `en.yml` without an `it.yml` counterpart fails here instead of silently
 * falling back to English at runtime.
 */
describe('locale key coverage (M3.T10)', () => {
  const enKeys = keyPaths('en');
  const itKeys = keyPaths('it');

  it('ships a translation for every EN key', () => {
    const missing = enKeys.filter((key) => !itKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it('defines exactly the same key tree in both locales (no stray IT keys)', () => {
    expect([...itKeys].sort()).toEqual([...enKeys].sort());
  });

  it('resolves every IT key to a non-empty string', () => {
    const text = readFileSync(resolve(LOCALES_DIR, 'it.yml'), 'utf8');
    const empty = parseMessagesText(text, 'YAML')
      .filter((message) => !message.key.join('.').startsWith('@@'))
      .filter(
        (message) =>
          message.type !== 'simple' ||
          message.message.trim().length === 0,
      )
      .map((message) => message.key.join('.'));
    expect(empty).toEqual([]);
  });

  it('has no manual language selector or persisted language preference', () => {
    const state = useAppStore.getState();
    expect(state).not.toHaveProperty('language');
    expect(state).not.toHaveProperty('locale');

    const slices = [
      state.timer,
      state.city,
      state.blocklist,
      state.score,
      state.sessionHistory,
      state.ui,
    ];
    for (const slice of slices) {
      expect(slice).not.toHaveProperty('language');
      expect(slice).not.toHaveProperty('locale');
    }
  });
});
