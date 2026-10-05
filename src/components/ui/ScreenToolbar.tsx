import { DrawerToggleButton } from 'expo-router/drawer';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { useIsTablet } from '@/hooks';
import { spacing, useTheme } from '@/theme';

import { Text } from './Text';

interface ScreenToolbarProps extends PropsWithChildren {
  title: string;
}

/** Header for screens that draw their own top bar: drawer button (phones), title, then actions. */
export function ScreenToolbar({ title, children }: ScreenToolbarProps) {
  const { colors } = useTheme();
  const isTablet = useIsTablet();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
      {isTablet ? (
        <View style={{ width: spacing.md }} />
      ) : (
        <DrawerToggleButton tintColor={colors.onSurface} />
      )}
      <Text variant="titleLarge" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
