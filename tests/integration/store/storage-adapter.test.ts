import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createBrowserStorage, browserStorage, SELF_WRITE } from '@/store/storage-adapter';

describe('createBrowserStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns null when the key does not exist', async () => {
    const storage = createBrowserStorage();
    await expect(storage.getItem('missing')).resolves.toBeNull();
  });

  it('returns the value previously written with setItem', async () => {
    const storage = createBrowserStorage();
    await storage.setItem('key', 'value');
    await expect(storage.getItem('key')).resolves.toBe('value');
  });

  it('overwrites an existing value on setItem', async () => {
    const storage = createBrowserStorage();
    await storage.setItem('key', 'first');
    await storage.setItem('key', 'second');
    await expect(storage.getItem('key')).resolves.toBe('second');
  });

  it('deletes the value on removeItem', async () => {
    const storage = createBrowserStorage();
    await storage.setItem('key', 'value');
    await storage.removeItem('key');
    await expect(storage.getItem('key')).resolves.toBeNull();
  });

  it('does not throw when removing a non-existent key', async () => {
    const storage = createBrowserStorage();
    await expect(storage.removeItem('missing')).resolves.toBeUndefined();
  });

  it('writes and reads a large value near storage.local limits', async () => {
    const storage = createBrowserStorage();
    const largeValue = 'x'.repeat(500_000);
    await storage.setItem('large', largeValue);
    await expect(storage.getItem('large')).resolves.toBe(largeValue);
  });

  it('treats a non-string stored value as missing', async () => {
    await fakeBrowser.storage.local.set({ key: 42 });
    const storage = createBrowserStorage();
    await expect(storage.getItem('key')).resolves.toBeNull();
  });

  it('keeps the data readable by a freshly created adapter (persist restart)', async () => {
    await createBrowserStorage().setItem('key', 'value');
    await expect(createBrowserStorage().getItem('key')).resolves.toBe('value');
  });

  it('exposes a shared browserStorage instance with the same behaviour', async () => {
    await browserStorage.setItem('key', 'value');
    await expect(browserStorage.getItem('key')).resolves.toBe('value');
  });

  it('recognizes consecutive self-writes as self-writes (M2.T11)', async () => {
    const storage = createBrowserStorage();
    await storage.setItem('key', 'first');
    await storage.setItem('key', 'second');

    expect(storage[SELF_WRITE].isSelfWrite('key', 'first')).toBe(true);
    expect(storage[SELF_WRITE].isSelfWrite('key', 'second')).toBe(true);
    // Each recorded write is consumed once: a repeated value is no longer ours.
    expect(storage[SELF_WRITE].isSelfWrite('key', 'first')).toBe(false);
  });

  it('does not treat a value this context never wrote as a self-write', async () => {
    const storage = createBrowserStorage();
    await storage.setItem('key', 'mine');

    expect(storage[SELF_WRITE].isSelfWrite('key', 'foreign')).toBe(false);
    expect(storage[SELF_WRITE].isSelfWrite('key', 'mine')).toBe(true);
  });
});
