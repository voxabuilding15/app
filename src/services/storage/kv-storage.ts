import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { STORAGE_ID } from '@/constants/app';
import type { KeyValueStorage } from '@/core';

const store = createMMKV({ id: STORAGE_ID });

export const kvStorage: KeyValueStorage = {
  getString: (key) => store.getString(key),
  setString: (key, value) => store.set(key, value),
  remove: (key) => void store.remove(key),
};

/** Adapter so Zustand `persist` reads and writes synchronously through MMKV. */
export const zustandStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => void store.remove(name),
};
