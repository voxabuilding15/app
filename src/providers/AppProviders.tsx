import { useEffect, useState, type PropsWithChildren } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ContainerProvider, type Container } from '@/core';
import { ThemeProvider } from '@/theme';

import { createContainer } from './createContainer';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [container] = useState<Container>(createContainer);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void container.notifications.initialize();
    });
    return () => task.cancel();
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
