import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, type PropsWithChildren } from 'react';

import { getDatabase } from '@/database';
import { notificationService, type NotificationService } from '@/services/notifications';
import { kvStorage, type KeyValueStorage } from '@/services/storage';

export interface Container {
  db: SQLiteDatabase;
  storage: KeyValueStorage;
  notifications: NotificationService;
}

export function createContainer(): Container {
  return {
    db: getDatabase(),
    storage: kvStorage,
    notifications: notificationService,
  };
}

const ContainerContext = createContext<Container | null>(null);

interface ContainerProviderProps extends PropsWithChildren {
  container: Container;
}

export function ContainerProvider({ container, children }: ContainerProviderProps) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (container === null) {
    throw new Error('useContainer must be used inside ContainerProvider');
  }
  return container;
}
