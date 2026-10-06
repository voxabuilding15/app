import { useContainer, type Container } from '@/core';
import { APP_NAME, APP_VERSION } from '@/constants/app';

import { DeviceRestoreEffects } from '../data/restore-effects';
import { SqliteBackupStore } from '../data/sqlite-backup-store';
import {
  UnavailableCloudProvider,
  createCloudUseCases,
  type CloudBackupProvider,
  type CloudUseCases,
} from '../domain/cloud';
import { createBackupUseCases, type BackupUseCases } from '../domain/usecases';

export interface BackupModule {
  backups: BackupUseCases;
  cloud: CloudUseCases;
}

const modules = new WeakMap<Container, BackupModule>();

/** Online backup services, in the order they are offered. Google Drive is wired but not built yet. */
function defaultProviders(): CloudBackupProvider[] {
  return [new UnavailableCloudProvider('google-drive', 'Google Drive')];
}

export function getBackupModule(
  container: Container,
  providers: CloudBackupProvider[] = defaultProviders(),
): BackupModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }
  const module: BackupModule = {
    backups: createBackupUseCases({
      store: new SqliteBackupStore(container.db),
      files: container.files,
      storage: container.storage,
      clock: container.clock,
      effects: new DeviceRestoreEffects(container.notifications, container.storage),
      appName: APP_NAME,
      appVersion: APP_VERSION,
    }),
    cloud: createCloudUseCases(providers),
  };
  modules.set(container, module);
  return module;
}

export function useBackupModule(): BackupModule {
  return getBackupModule(useContainer());
}
