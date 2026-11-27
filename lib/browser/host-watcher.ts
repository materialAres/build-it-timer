export interface HostWatcherOptions {
  /** Every node whose subtree is watched (`childList`, `subtree`). */
  readonly targets: readonly Node[];
  /** Asked after each batch of mutations. */
  readonly isLost: () => boolean;
  /** Called when `isLost()` is true. */
  readonly onLost: () => void;
}

export interface HostWatcher {
  readonly disconnect: () => void;
}

export function createHostWatcher(options: HostWatcherOptions): HostWatcher {
  const { targets, isLost, onLost } = options;
  const observer = new MutationObserver(() => {
    if (isLost()) onLost();
  });
  for (const target of targets) {
    observer.observe(target, { childList: true, subtree: true });
  }
  return {
    disconnect: () => {
      observer.disconnect();
    },
  };
}
