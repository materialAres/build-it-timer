import { describe, expect, it, vi } from 'vitest';
import { openExtensionPage, type ExtensionPageApi } from '@/lib/browser/open-extension-page';

function api(overrides: Partial<ExtensionPageApi> = {}): ExtensionPageApi & { created: string[] } {
  const created: string[] = [];
  return {
    getUrl: (path) => `chrome-extension://abc${path}`,
    createTab: (url) => { created.push(url); return Promise.resolve(); },
    ...overrides,
    created,
  };
}

describe('openExtensionPage (CR6.T11)', () => {
  it("opens the extension's own page in a new tab", async () => {
    const fake = api();
    const result = await openExtensionPage('/city.html', fake);

    expect(result.ok).toBe(true);
    expect(fake.created).toEqual(['chrome-extension://abc/city.html']);
  });

  it('is an error result, never a throw, when the tab cannot be created', async () => {
    const fake = api({ createTab: vi.fn(() => Promise.reject(new Error('no window'))) });
    const result = await openExtensionPage('/city.html', fake);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe('no window');
  });

  it('is an error result when building the URL throws', async () => {
    const fake = api({ getUrl: () => { throw new Error('bad path'); } });
    expect((await openExtensionPage('/city.html', fake)).ok).toBe(false);
  });
});
