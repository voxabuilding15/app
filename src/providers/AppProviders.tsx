import { useEffect, useState, type PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ContainerProvider, createContainer, type Container } from '@/core/di/container';
import { ThemeProvider } from '@/theme';

import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [container] = useState<Container>(createContainer);

  useEffect(() => {
    void container.notifications.initialize();
  }, [container]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ContainerProvider container={container}>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </ContainerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
