import { Tabs } from 'expo-router';
import { DrawerToggleButton } from 'expo-router/drawer';

import { Icon } from '@/components';
import { useIsTablet } from '@/hooks';
import { useTranslator } from '@/i18n';
import { TAB_ITEMS } from '@/navigation';
import { tabBarStyleFor, useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const { t } = useTranslator();

  return (
    <Tabs
      screenOptions={{
        freezeOnBlur: true,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.onSurface },
        headerShadowVisible: false,
        // The drawer is permanently visible on tablets, so the toggle is only needed on phones.
        headerLeft: isTablet
          ? () => null
          : () => <DrawerToggleButton tintColor={colors.onSurface} />,
        tabBarActiveTintColor: colors.onSecondaryContainer,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: tabBarStyleFor(colors),
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TAB_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: t(item.title),
            headerShown: item.ownHeader !== true,
            tabBarIcon: ({ color, size }) => <Icon name={item.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
