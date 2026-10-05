import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Drawer } from 'expo-router/drawer';
import { useEffect } from 'react';

import '../global.css';

import { APP_NAME } from '@/constants/app';
import { DRAWER_ITEMS, DrawerContent } from '@/navigation';
import { AppProviders } from '@/providers';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Drawer
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.onSurface },
          headerTintColor: colors.onSurface,
          headerShadowVisible: false,
          drawerType: 'front',
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Drawer.Screen name="(tabs)" options={{ title: APP_NAME, headerShown: false }} />
        {DRAWER_ITEMS.map((item) => (
          <Drawer.Screen key={item.name} name={item.name} options={{ title: item.title }} />
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
