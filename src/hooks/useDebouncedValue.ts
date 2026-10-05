import { useEffect, useState } from 'react';

/** Returns `value` after it has stopped changing for `delayMs`. Empty strings apply immediately. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const immediate = value === '' || delayMs === 0;
    const timer = setTimeout(() => setDebounced(value), immediate ? 0 : delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
