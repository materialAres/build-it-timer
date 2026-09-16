import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('fakeBrowser', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('should provide working storage.local mock', async () => {
    await fakeBrowser.storage.local.set({ 'test-key': 'test-value' });
    const result = await fakeBrowser.storage.local.get('test-key');
    expect(result['test-key']).toBe('test-value');
  });
});