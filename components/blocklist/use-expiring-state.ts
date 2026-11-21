import { useEffect, useState } from 'react';

/**
 * State that empties itself `ms` after it was last set (UI.T6): a confirmation
 * or an announcement that should not linger. Setting a new value restarts the
 * clock; setting `null` clears it at once.
 */
export function useExpiringState<T>(
  ms: number,
): readonly [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    if (value === null) return;
    const timer = globalThis.setTimeout(() => {
      setValue(null);
    }, ms);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [value, ms]);

  return [value, setValue];
}
