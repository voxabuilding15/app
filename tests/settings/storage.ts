import type { KeyValueStorage } from '@/core';

export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}
