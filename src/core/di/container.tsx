import { createContext, useContext, type PropsWithChildren } from 'react';

import type { Database, KeyValueStorage, NotificationService } from '../ports';

export interface Container {
  db: Database;
  storage: KeyValueStorage;
  notifications: NotificationService;
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
