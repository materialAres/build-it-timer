import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostWatcher } from '@/lib/browser/host-watcher';

// A MutationObserver delivers its records in a microtask.
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('createHostWatcher (PR10.T2)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const setup = (): { first: HTMLElement; second: HTMLElement; child: HTMLElement } => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const child = document.createElement('span');
    first.append(child);
    document.body.append(first, second);
    return { first, second, child };
  };

  it('calls onLost once when a child is removed and isLost is true', async () => {
    const { first, child } = setup();
    const onLost = vi.fn();
    const watcher = createHostWatcher({ targets: [first], isLost: () => true, onLost });

    child.remove();
    await flush();

    expect(onLost).toHaveBeenCalledTimes(1);
    watcher.disconnect();
  });

  it('does not call onLost while isLost is false', async () => {
    const { first, child } = setup();
    const onLost = vi.fn();
    const watcher = createHostWatcher({ targets: [first], isLost: () => false, onLost });

    child.remove();
    await flush();

    expect(onLost).not.toHaveBeenCalled();
    watcher.disconnect();
  });

  it('does not call onLost after disconnect, and disconnect twice is safe', async () => {
    const { first, child } = setup();
    const onLost = vi.fn();
    const watcher = createHostWatcher({ targets: [first], isLost: () => true, onLost });

    watcher.disconnect();
    expect(() => {
      watcher.disconnect();
    }).not.toThrow();
    child.remove();
    await flush();

    expect(onLost).not.toHaveBeenCalled();
  });

  it('watches every node in targets', async () => {
    const { first, second } = setup();
    const onLost = vi.fn();
    const watcher = createHostWatcher({ targets: [first, second], isLost: () => true, onLost });

    second.append(document.createElement('i'));
    await flush();

    expect(onLost).toHaveBeenCalledTimes(1);
    watcher.disconnect();
  });
});
