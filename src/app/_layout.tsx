import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import { Drawer } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '../global.css';

import { APP_NAME } from '@/constants/app';
import { AchievementsBridge } from '@/features/achievements';
import { EventNotificationBridge } from '@/features/calendar';
import { FinanceBridge } from '@/features/finance';
import { HabitNotificationBridge } from '@/features/habits';
import { NotesBridge } from '@/features/notes';
import { PomodoroBridge } from '@/features/pomodoro';
import { TaskNotificationBridge } from '@/features/tasks';
import { useIsTablet } from '@/hooks';
import { DRAWER_ITEMS, DrawerContent, TABS_ROUTE } from '@/navigation';
import { AppProviders } from '@/providers';
import { DRAWER_WIDTH, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const isTablet = useIsTablet();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TaskNotificationBridge />
      <HabitNotificationBridge />
      <FinanceBridge />
      <EventNotificationBridge />
      <NotesBridge />
      <PomodoroBridge />
      <AchievementsBridge />
      <Drawer
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          freezeOnBlur: true,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.onSurface },
          headerTintColor: colors.onSurface,
          headerShadowVisible: false,
          drawerType: isTablet ? 'permanent' : 'front',
          drawerStyle: { width: DRAWER_WIDTH, backgroundColor: colors.surface },
          swipeEdgeWidth: 32,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Drawer.Screen name={TABS_ROUTE} options={{ title: APP_NAME, headerShown: false }} />
        {DRAWER_ITEMS.map((item) => (
          <Drawer.Screen
            key={item.name}
            name={item.name}
            options={{
              title: item.title,
              headerShown: item.ownHeader ? false : undefined,
              headerLeft: isTablet ? () => null : undefined,
            }}
          />
        ))}
      </Drawer>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(MaterialIcons.font);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
