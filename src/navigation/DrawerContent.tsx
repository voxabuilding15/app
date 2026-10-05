import { Image } from 'expo-image';
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components';
import { APP_NAME } from '@/constants/app';
import { radius, spacing, useTheme } from '@/theme';

import { DRAWER_ITEMS } from './routes';

const LOGO = require('../../assets/images/icon.png');

export function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const activeName = state.routes[state.index]?.name;

  return (
    <DrawerContentScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      style={{ backgroundColor: colors.surface }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        <Image
          source={LOGO}
          style={{ width: 48, height: 48, borderRadius: radius.md }}
          accessibilityLabel={`${APP_NAME} logo`}
        />
        <Text variant="titleLarge">{APP_NAME}</Text>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Home"
        accessibilityState={{ selected: activeName === '(tabs)' }}
        onPress={() => navigation.navigate('(tabs)')}
        pressedScale={0.99}
        style={{
          borderRadius: radius.full,
          backgroundColor: activeName === '(tabs)' ? colors.secondaryContainer : 'transparent',
        }}
      >
        <DrawerRow icon="home" label="Home" active={activeName === '(tabs)'} />
      </PressableScale>

      {DRAWER_ITEMS.map((item) => {
        const active = activeName === item.name;
        return (
          <PressableScale
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: active }}
            onPress={() => navigation.navigate(item.name)}
            pressedScale={0.99}
            style={{
              borderRadius: radius.full,
              backgroundColor: active ? colors.secondaryContainer : 'transparent',
            }}
          >
            <DrawerRow icon={item.icon} label={item.title} active={active} />
          </PressableScale>
        );
      })}
    </DrawerContentScrollView>
  );
}

interface DrawerRowProps {
  icon: (typeof DRAWER_ITEMS)[number]['icon'];
  label: string;
  active: boolean;
}

function DrawerRow({ icon, label, active }: DrawerRowProps) {
  const { colors } = useTheme();
  const color = active ? colors.onSecondaryContainer : colors.onSurfaceVariant;

  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Icon name={icon} color={color} />
      <Text variant="labelLarge" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
