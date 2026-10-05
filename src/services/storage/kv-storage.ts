import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { STORAGE_ID } from '@/constants/app';

export interface KeyValueStorage {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getBoolean(key: string): boolean | undefined;
  setBoolean(key: string, value: boolean): void;
  remove(key: string): void;
  clear(): void;
}

class MmkvKeyValueStorage implements KeyValueStorage {
  constructor(private readonly store: MMKV) {}

  getString(key: string): string | undefined {
    return this.store.getString(key);
  }

  setString(key: string, value: string): void {
    this.store.set(key, value);
  }

  getBoolean(key: string): boolean | undefined {
    return this.store.getBoolean(key);
  }

  setBoolean(key: string, value: boolean): void {
    this.store.set(key, value);
  }

  remove(key: string): void {
    this.store.remove(key);
  }

  clear(): void {
    this.store.clearAll();
  }
}

export const kvStorage: KeyValueStorage = new MmkvKeyValueStorage(createMMKV({ id: STORAGE_ID }));

export const zustandStorage: StateStorage = {
  getItem: (name) => kvStorage.getString(name) ?? null,
  setItem: (name, value) => kvStorage.setString(name, value),
  removeItem: (name) => kvStorage.remove(name),
};
