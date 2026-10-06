import {
  StorageLockStore,
  createId,
  createLockUseCases,
  readPrivacy,
  useContainer,
  writePrivacy,
  type Container,
  type LockUseCases,
  type PrivacySettings,
} from '@/core';

import { SqliteDataUsage } from '../data/sqlite-usage';
import { APP_LOCK_STORAGE_KEY, SecuritySettingsStore } from '../domain/security';
import type { DataUsageSource } from '../domain/usage';

export interface SettingsModule {
  /** The lock on the whole app. It stays open until the app has been away for a while. */
  appLock: LockUseCases;
  security: SecuritySettingsStore;
  usage: DataUsageSource;
  privacy: { read: () => PrivacySettings; write: (settings: PrivacySettings) => void };
}

const modules = new WeakMap<Container, SettingsModule>();

export function getSettingsModule(container: Container): SettingsModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }
  const { storage, clock, authenticator, db } = container;
  const module: SettingsModule = {
    appLock: createLockUseCases({
      store: new StorageLockStore(storage, APP_LOCK_STORAGE_KEY),
      authenticator,
      clock,
      newSalt: createId,
      subject: 'app',
      unlockWindowMs: Number.POSITIVE_INFINITY,
    }),
    security: new SecuritySettingsStore(storage),
    usage: new SqliteDataUsage(db),
    privacy: {
      read: () => readPrivacy(storage),
      write: (settings) => writePrivacy(storage, settings),
    },
  };
  modules.set(container, module);
  return module;
}

export function useSettingsModule(): SettingsModule {
  return getSettingsModule(useContainer());
}
