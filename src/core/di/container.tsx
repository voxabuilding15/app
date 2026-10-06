import { createContext, useContext, type PropsWithChildren } from 'react';

import type { Clock, Database, FileService, KeyValueStorage, NotificationService } from '../ports';
import type { CategoryKind, CategoryRepository } from '../taxonomy';

export interface Container {
  clock: Clock;
  db: Database;
  /** Persistence for the categories of one feature. */
  categories: (kind: CategoryKind) => CategoryRepository;
  storage: KeyValueStorage;
  notifications: NotificationService;
  files: FileService;
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
