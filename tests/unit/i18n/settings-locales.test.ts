import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMessagesText } from '@wxt-dev/i18n/build';
import { SOUND_THEMES } from '@/lib/sound/sound-themes';

const LOCALES_DIR = resolve(import.meta.dirname, '../../../locales');

/** Every message of a locale source, by dotted key path. */
function messages(locale: string): ReadonlyMap<string, string> {
  const text = readFileSync(resolve(LOCALES_DIR, `${locale}.yml`), 'utf8');
  const entries = parseMessagesText(text, 'YAML')
    .filter((message) => !message.key.join('.').startsWith('@@'))
    .flatMap((message): Array<[string, string]> =>
      message.type === 'simple' ? [[message.key.join('.'), message.message]] : [],
    );
  return new Map(entries);
}

/** The Settings copy fixed by the M5.T16 card: [key, EN, IT]. */
const COPY: ReadonlyArray<readonly [string, string, string]> = [
  ['tabs.settings', 'Settings', 'Impostazioni'],
  ['settings.title', 'Settings', 'Impostazioni'],
  ['settings.sound.heading', 'Sound', 'Suono'],
  [
    'settings.sound.enabled',
    'Play a sound when a session starts and ends',
    "Riproduci un suono all'inizio e alla fine della sessione",
  ],
  ['settings.sound.theme', 'Sound theme', 'Tema sonoro'],
  ['settings.sound.themes.neon', 'Neon', 'Neon'],
  ['settings.sound.themes.synthwave', 'Synthwave', 'Synthwave'],
  ['settings.sound.themes.glitch', 'Glitch', 'Glitch'],
  ['settings.sound.themes.terminal', 'Terminal', 'Terminale'],
  ['settings.sound.preview', 'Preview $1', 'Ascolta $1'],
  ['settings.sound.volume', 'Volume', 'Volume'],
  ['settings.sound.volumeValue', '$1%', '$1%'],
];

describe('Settings and sound locale strings (M5.T16)', () => {
  const en = messages('en');
  const it_ = messages('it');

  it.each(COPY)('%s has the agreed English and Italian copy', (key, english, italian) => {
    expect(en.get(key)).toBe(english);
    expect(it_.get(key)).toBe(italian);
  });

  it.each([['en'], ['it']])(
    'has one theme name per sound theme in %s, and no other',
    (locale) => {
      const themeKeys = [...messages(locale).keys()]
        .filter((key) => key.startsWith('settings.sound.themes.'))
        .map((key) => key.slice('settings.sound.themes.'.length));
      expect(themeKeys.sort()).toEqual(SOUND_THEMES.map((theme) => theme.id).sort());
    },
  );

  it('keeps the same $1 placeholder in the preview label in both languages', () => {
    expect(en.get('settings.sound.preview')).toContain('$1');
    expect(it_.get('settings.sound.preview')).toContain('$1');
  });
});
