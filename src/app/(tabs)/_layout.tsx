import { Tabs } from 'expo-router';
import { DrawerToggleButton } from 'expo-router/drawer';

import { Icon } from '@/components';
import { TAB_ITEMS } from '@/navigation';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.onSurface },
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor={colors.onSurface} />,
        tabBarActiveTintColor: colors.onSecondaryContainer,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.outlineVariant,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TAB_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarIcon: ({ color, size }) => <Icon name={item.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
