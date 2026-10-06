import type { KeyValueStorage } from '@/core';

import { NO_LOCK, type LockConfig, type LockMethod } from '../domain/lock';
import type { LockStore, WidgetPublisher } from '../domain/ports';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '../domain/widget';

const LOCK_KEY = 'notes.lock';
const METHODS: readonly LockMethod[] = ['none', 'device', 'pin'];

/** Remembers how notes are locked in the app's key-value storage. */
export class StorageLockStore implements LockStore {
  constructor(private readonly storage: KeyValueStorage) {}

  read(): LockConfig {
    const raw = this.storage.getString(LOCK_KEY);
    if (raw === undefined) {
      return NO_LOCK;
    }
    try {
      const data = JSON.parse(raw) as Partial<LockConfig>;
      if (!METHODS.includes(data.method as LockMethod)) {
        return NO_LOCK;
      }
      // A PIN lock without its hash could never be opened, so treat it as unlocked-by-device.
      if (
        data.method === 'pin' &&
        (typeof data.pinHash !== 'string' || typeof data.pinSalt !== 'string')
      ) {
        return NO_LOCK;
      }
      return {
        method: data.method as LockMethod,
        pinHash: data.pinHash ?? null,
        pinSalt: data.pinSalt ?? null,
      };
    } catch {
      return NO_LOCK;
    }
  }

  write(config: LockConfig): void {
    if (config.method === 'none') {
      this.storage.remove(LOCK_KEY);
    } else {
      this.storage.setString(LOCK_KEY, JSON.stringify(config));
    }
  }
}

/** Writes the widget snapshot where a home screen widget can read it. */
export class StorageWidgetPublisher implements WidgetPublisher {
  constructor(private readonly storage: KeyValueStorage) {}

  publish(snapshot: WidgetSnapshot): void {
    this.storage.setString(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
}
